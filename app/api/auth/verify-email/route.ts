import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();
    if (!email) {
      return NextResponse.json({
        success: false,
        error: 'Email is required'
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

    // If code is present, verify code
    if (code) {
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
    }

    // If no code, resend verification code
    const crypto = require('crypto');
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    user.verificationCode = verificationCode;
    user.verificationCodeExpiry = verificationCodeExpiry;
    user.updatedAt = new Date();
    await user.save();

    const { emailService } = require('@/lib/email');
    const emailSent = await emailService.sendEmailVerificationCode({
      email: user.email,
      name: user.name || user.displayName || 'User',
      code: verificationCode
    });
    if (!emailSent) {
      return NextResponse.json({
        success: false,
        error: 'Failed to send verification code'
      }, { status: 500 });
    }
    console.log(`[verify-email] Verification code resent to: ${user.email}`);
    return NextResponse.json({
      success: true,
      message: 'Verification code sent successfully'
    });
  } catch (error) {
    console.error('[verify-email] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}