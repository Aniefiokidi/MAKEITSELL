
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getUserBySessionToken } from '@/lib/auth'
export async function GET() {
  console.log('[/api/auth/me] GET request received');
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('sessionToken')?.value;
  console.log('[/api/auth/me] sessionToken from cookie:', sessionToken ? 'EXISTS' : 'MISSING');
  if (!sessionToken) {
    console.log('[/api/auth/me] No sessionToken found, returning 401');
    return NextResponse.json({ user: null }, { status: 401 });
  }

  // Validate sessionToken and fetch user from DB
  console.log('[/api/auth/me] Looking up user with sessionToken...');
  const user = await getUserBySessionToken(sessionToken);
  console.log('[/api/auth/me] User lookup result:', user ? 'FOUND' : 'NOT FOUND');
  if (!user) {
    console.log('[/api/auth/me] User not found, returning 401');
    return NextResponse.json({ user: null }, { status: 401 });
  }

  // Optionally, fetch user profile details here if needed
  console.log('[/api/auth/me] Returning user:', user);
  return NextResponse.json({ user });
}
