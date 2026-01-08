
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getUserBySessionToken } from '@/lib/auth'
export async function GET() {

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('sessionToken')?.value;
  if (!sessionToken) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  // Validate sessionToken and fetch user from DB
  const user = await getUserBySessionToken(sessionToken);
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  // Optionally, fetch user profile details here if needed
  return NextResponse.json({ user });
}
