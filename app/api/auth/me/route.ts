import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getUserBySessionToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    console.log('[/api/auth/me] GET request received');
    const cookieStore = await cookies();
    
    // Try to get sessionToken from cookie first
    let sessionToken = cookieStore.get('sessionToken')?.value;
    
    // If no cookie, try to get from X-Session-Token header (fallback)
    if (!sessionToken) {
      sessionToken = request.headers.get('X-Session-Token') || undefined;
      if (sessionToken) {
        console.log('[/api/auth/me] Got sessionToken from X-Session-Token header');
      }
    } else {
      console.log('[/api/auth/me] Got sessionToken from cookie');
    }
    
    console.log('[/api/auth/me] sessionToken exists:', !!sessionToken);
    
    if (!sessionToken) {
      console.log('[/api/auth/me] No sessionToken found');
      return NextResponse.json({ user: null, success: false }, { status: 401 });
    }

    // Validate sessionToken and fetch user from DB
    console.log('[/api/auth/me] Looking up user with sessionToken');
    const user = await getUserBySessionToken(sessionToken);
    console.log('[/api/auth/me] User lookup result:', user ? 'FOUND' : 'NOT FOUND');
    
    if (!user) {
      console.log('[/api/auth/me] User not found with token');
      return NextResponse.json({ user: null, success: false }, { status: 401 });
    }

    // Return user data
    console.log('[/api/auth/me] Returning user:', user.email);
    return NextResponse.json({ user, success: true }, { status: 200 });
  } catch (error: any) {
    console.error('[/api/auth/me] Error:', error);
    return NextResponse.json({ user: null, success: false, error: error?.message }, { status: 500 });
  }
}
