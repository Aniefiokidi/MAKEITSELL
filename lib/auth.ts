
import { connectToDatabase } from './mongodb';
import crypto from 'crypto';
import { User } from './models/User';
import { hashPassword, needsPasswordRehash, verifyPassword } from './password';

export async function signUp({ email, password, name, role, vendorInfo, phone }: { email: string, password: string, name: string, role?: string, vendorInfo?: any, phone?: string }) {
  await connectToDatabase();
  const existing = await User.findOne({ email });
  if (existing) throw new Error('Email already in use');
  
  const passwordHash = hashPassword(password);
  const sessionToken = crypto.randomBytes(32).toString('hex');
  
  // Generate a 6-digit verification OTP code valid for 10 minutes.
  const emailVerificationToken = String(Math.floor(100000 + Math.random() * 900000));
  const emailVerificationTokenExpiry = new Date(Date.now() + 10 * 60 * 1000);
  
  const user = await User.create({
    email,
    passwordHash,
    name,
    phone,
    phone_number: phone,
    phone_verified: false,
    role: role || 'customer',
    walletBalance: 0,
    vendorInfo,
    sessionToken,
    isEmailVerified: false,
    emailVerificationToken,
    emailVerificationTokenExpiry,
  });

  // Send verification email
  try {
    const { emailService } = require('./email');
    await emailService.sendEmailVerification({
      email: user.email,
      name: user.name || 'User',
      verificationCode: emailVerificationToken
    });
    console.log(`[auth.signUp] Verification email sent to: ${user.email}`);
  } catch (emailError) {
    console.error('[auth.signUp] Failed to send verification email:', emailError);
    // Don't fail signup if email fails - user can request resend
  }

  return {
    success: true,
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      address: (user as any).address,
      city: (user as any).city,
      state: (user as any).state,
      postalCode: (user as any).postalCode,
      vendorType: user.role === 'vendor' ? user.vendorInfo?.businessType : undefined,
      walletBalance: typeof user.walletBalance === 'number' ? user.walletBalance : 0
    },
    sessionToken
  };
}

export async function signIn({ email, password }: { email: string, password: string }) {
  await connectToDatabase();
  const user = await User.findOne({ email });
  if (!user) throw new Error('Invalid credentials');
  
  // Check email verification
  if (!user.isEmailVerified) {
    // Check if this is a legacy user (no verification token set)
    if (!user.emailVerificationToken || !user.emailVerificationTokenExpiry) {
      // This is likely a legacy user - we'll offer to send verification email
      throw new Error('EMAIL_NOT_VERIFIED_LEGACY');
    } else {
      // User has been sent verification email but hasn't verified.
      throw new Error('Please verify your email address before signing in. Check your inbox for your OTP code.');
    }
  }
  
  let shouldRehash = false

  // Primary path: use passwordHash
  if (user.passwordHash) {
    if (!verifyPassword(password, user.passwordHash)) throw new Error('Invalid credentials');
    shouldRehash = needsPasswordRehash(user.passwordHash)
  } else {
    // Backward compatibility: some legacy users only have `password` field
    const legacyPassword: string | undefined = (user as any).password;

    // If legacy password matches plaintext input OR hashed input, accept and upgrade
    const legacyMatches = !!legacyPassword && (
      legacyPassword === password || verifyPassword(password, legacyPassword)
    );
    if (!legacyMatches) {
      throw new Error('Your account is missing a password hash. Please reset your password or contact support.');
    }
    shouldRehash = true
  }
  
  // Generate new session token
  const newSessionToken = crypto.randomBytes(32).toString('hex');

  let walletBalance = typeof (user as any).walletBalance === 'number' ? (user as any).walletBalance : 0;
  
  // Use direct database update instead of Mongoose save to avoid document issues
  const mongoose = require('mongoose');
  const db = mongoose.connection.db;
  
  const updateResult = await db.collection('users').updateOne(
    { email: email },
    { 
      $set: { 
        sessionToken: newSessionToken,
        ...(shouldRehash ? { passwordHash: hashPassword(password) } : {}),
        walletBalance,
        updatedAt: new Date()
      } 
    }
  );
  
  return { 
    success: true, 
    user: { 
      id: user._id, 
      email: user.email, 
      name: user.name, 
      role: user.role,
      phone: (user as any).phone,
      phone_number: (user as any).phone_number,
      phone_verified: !!(user as any).phone_verified,
      address: (user as any).address,
      city: (user as any).city,
      state: (user as any).state,
      postalCode: (user as any).postalCode,
      vendorType: user.role === 'vendor' ? user.vendorInfo?.businessType : undefined,
      walletBalance
    }, 
    sessionToken: newSessionToken 
  };
}

export async function getUserBySessionToken(sessionToken: string) {
  await connectToDatabase();
  const user = await User.findOne({ sessionToken });
  if (!user) return null;

  let walletBalance = typeof (user as any).walletBalance === 'number' ? (user as any).walletBalance : undefined;
  if (walletBalance === undefined) {
    walletBalance = 0;
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          walletBalance,
          updatedAt: new Date()
        }
      }
    );
  }

  return { 
    id: user._id, 
    email: user.email, 
    name: user.name, 
    role: user.role,
    phone: (user as any).phone,
    phone_number: (user as any).phone_number,
    phone_verified: !!(user as any).phone_verified,
    address: (user as any).address,
    city: (user as any).city,
    state: (user as any).state,
    postalCode: (user as any).postalCode,
    vendorType: user.role === 'vendor' ? user.vendorInfo?.businessType : undefined,
    isEmailVerified: user.isEmailVerified || false,
    walletBalance
  };
}
