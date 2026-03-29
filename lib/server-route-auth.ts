import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySessionToken } from '@/lib/auth'

type SessionUser = {
  id: string
  email: string
  name?: string
  role: string
}

export async function getSessionUserFromRequest(request: NextRequest): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('sessionToken')?.value

  if (!sessionToken) return null

  try {
    const user = await getUserBySessionToken(sessionToken)
    if (!user) return null
    return {
      id: String(user.id),
      email: user.email,
      name: user.name,
      role: user.role,
    }
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
