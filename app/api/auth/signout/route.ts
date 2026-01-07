
import { NextRequest, NextResponse } from 'next/server'
import { serialize } from 'cookie'

export async function POST(request: NextRequest) {
  try {
    // Get sessionToken from cookie
    const sessionToken = request.cookies.get('sessionToken')?.value

    if (sessionToken) {
      // Invalidate session in DB if needed
      // TODO: Remove session from DB if you want
      console.log('Invalidating session token:', sessionToken)
    }

    // Clear the sessionToken cookie
    const cookie = serialize('sessionToken', '', {
      httpOnly: true,
      path: '/',
      maxAge: 0,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
    return new NextResponse(JSON.stringify({
      success: true,
      message: 'Successfully signed out'
    }), {
      status: 200,
      headers: { 'Set-Cookie': cookie, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Signout error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to sign out'
    }, { status: 500 })
  }
}