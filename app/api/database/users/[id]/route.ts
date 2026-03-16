import { NextRequest, NextResponse } from 'next/server';
import { getUserById } from '@/lib/mongodb-operations';
import { getSessionUserFromRequest } from '@/lib/server-route-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }
    const sessionUser = await getSessionUserFromRequest(request)
    const isSelf = sessionUser?.id === id
    const isAdmin = sessionUser?.role === 'admin'
    if (!isSelf && !isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const user = await getUserById(id);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const {
      password,
      passwordHash,
      sessionToken,
      emailVerificationToken,
      emailVerificationTokenExpiry,
      withdrawalPinHash,
      ...safeUser
    } = user as any

    return NextResponse.json({ success: true, data: safeUser });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch user' }, { status: 500 });
  }
}
