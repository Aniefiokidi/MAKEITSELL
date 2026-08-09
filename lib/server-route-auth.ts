import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySessionToken } from '@/lib/auth'

type SessionUser = {
  id: string
  email: string
  name?: string
  role: string
}

// `Authorization: Bearer <token>` fallback — for clients (the mobile app) that can't
// rely on an httpOnly cookie jar. Same token, same lookup as the cookie path below;
// this only changes where the token is read FROM, never how it's validated.
function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization')
  if (!header) return null
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}

function toSessionUser(user: NonNullable<Awaited<ReturnType<typeof getUserBySessionToken>>>): SessionUser {
  return {
    id: String(user.id),
    email: user.email,
    name: user.name,
    role: user.role,
  }
}

export async function getSessionUserFromRequest(request: NextRequest): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const cookieToken = cookieStore.get('sessionToken')?.value

  try {
    // Cookie path first — identical to the original, unchanged behavior. Only falls
    // through to the Bearer header when there's no *valid* session cookie (not merely
    // when the cookie is absent), so a request carrying both a stale cookie and a fresh
    // Bearer token still authenticates correctly.
    if (cookieToken) {
      const cookieUser = await getUserBySessionToken(cookieToken)
      if (cookieUser) return toSessionUser(cookieUser)
    }

    const bearerToken = getBearerToken(request)
    if (!bearerToken) return null

    const bearerUser = await getUserBySessionToken(bearerToken)
    if (!bearerUser) return null
    return toSessionUser(bearerUser)
  } catch {
    return null
  }
}

export async function requireRoles(
  request: NextRequest,
  allowedRoles: string[]
): Promise<{ user?: SessionUser; response?: NextResponse }> {
  const user = await getSessionUserFromRequest(request)
  if (!user) {
    return {
      response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
    }
  }

  if (!allowedRoles.includes(user.role)) {
    return {
      response: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { user }
}

export async function requireAdminAccess(request: NextRequest): Promise<NextResponse | null> {
  const adminSecret = (process.env.ADMIN_SECRET || '').trim()
  const authHeader = request.headers.get('authorization') || ''

  if (adminSecret && authHeader === `Bearer ${adminSecret}`) {
    return null
  }

  const { response } = await requireRoles(request, ['admin'])
  return response || null
}

export async function requireCronOrAdminAccess(request: NextRequest): Promise<NextResponse | null> {
  const cronSecret = (process.env.CRON_SECRET || '').trim()
  const authHeader = request.headers.get('authorization') || ''

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return null
  }

  return await requireAdminAccess(request)
}
