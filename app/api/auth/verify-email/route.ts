// POST /api/auth/verify-email/code
export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();
    if (!email || !code) {
      return NextResponse.json({
        success: false,
        error: 'Email and code are required'
      }, { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findOne({ email });
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }
    if (user.isEmailVerified) {
      return NextResponse.json({
        success: false,
        error: 'Email is already verified'
      }, { status: 400 });
    }
    if (!user.verificationCode || !user.verificationCodeExpiry) {
      return NextResponse.json({
        success: false,
        error: 'No verification code found. Please request a new code.'
      }, { status: 400 });
    }
    if (user.verificationCode !== code) {
      return NextResponse.json({
        success: false,
        error: 'Invalid verification code'
      }, { status: 400 });
    }
    if (user.verificationCodeExpiry < new Date()) {
      return NextResponse.json({
        success: false,
        error: 'Verification code expired. Please request a new code.'
      }, { status: 400 });
    }
    user.isEmailVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpiry = undefined;
    user.updatedAt = new Date();
    const crypto = require('crypto');
    const sessionToken = crypto.randomBytes(32).toString('hex');
    user.sessionToken = sessionToken;
    await user.save();
    const { serialize } = require('cookie');
    const cookie = serialize('sessionToken', sessionToken, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: 'lax',
      secure: true,
    });
    return new NextResponse(JSON.stringify({
      success: true,
      message: 'Email verified successfully',
      redirectUrl: '/stores'
    }), {
      status: 200,
      headers: { 'Set-Cookie': cookie, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[verify-email/code] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// Resend verification email
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({
        success: false,
        error: 'Email is required'
      }, { status: 400 })
    }

    await connectToDatabase()

    const user = await User.findOne({ email })

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 })
    }

    if (user.isEmailVerified) {
      return NextResponse.json({
        success: false,
        error: 'Email is already verified'
      }, { status: 400 })
    }

    // Generate new verification token
    const crypto = require('crypto')
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    user.emailVerificationToken = verificationToken
    user.emailVerificationTokenExpiry = tokenExpiry
    user.updatedAt = new Date()
    await user.save()

    // Send verification email
    const { emailService } = require('@/lib/email')
    // Use SITE_URL or NEXT_PUBLIC_SITE_URL, fallback to makeitsell.org, never VERCEL_URL
    const baseUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://makeitsell.org';
    const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;

    const emailSent = await emailService.sendEmailVerification({
      email: user.email,
      name: user.name || user.displayName || 'User',
      verificationUrl
    })

    if (!emailSent) {
      return NextResponse.json({
        success: false,
        error: 'Failed to send verification email'
      }, { status: 500 })
    }

    console.log(`[verify-email] Verification email resent to: ${user.email}`)

    return NextResponse.json({
      success: true,
      message: 'Verification email sent successfully'
    })

  } catch (error: any) {
    console.error('[verify-email] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}