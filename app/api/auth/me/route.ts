
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/mongodb-auth'
import { getUserProfile } from '@/lib/auth-client'

export async function GET() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('sessionToken')?.value
  if (!sessionToken) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  // Validate sessionToken and fetch user from DB
  const result = await getCurrentUser(sessionToken)
  if (!result.success || !result.user) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  const user = result.user
  const userProfile = await getUserProfile(user.id)
  return NextResponse.json({ user, userProfile })
}
