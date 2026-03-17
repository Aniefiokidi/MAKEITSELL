
import { connectToDatabase } from './mongodb';
import crypto from 'crypto';
import { User } from './models/User';

function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export async function signUp({ email, password, name, role, vendorInfo, phone }: { email: string, password: string, name: string, role?: string, vendorInfo?: any, phone?: string }) {
  await connectToDatabase();
  const existing = await User.findOne({ email });
  if (existing) throw new Error('Email already in use');
  
  const passwordHash = hashPassword(password);
  const sessionToken = crypto.randomBytes(32).toString('hex');
  
  // Generate email verification token
  const emailVerificationToken = crypto.randomBytes(32).toString('hex');
  const emailVerificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
  const user = await User.create({
    email,
    passwordHash,
    name,
    phone,
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
    // Use SITE_URL or NEXT_PUBLIC_SITE_URL, fallback to makeitsell.org, never VERCEL_URL
    const baseUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.makeitsell.org';
    const verificationUrl = `${baseUrl}/verify-email?token=${emailVerificationToken}`;
    await emailService.sendEmailVerification({
      email: user.email,
      name: user.name || 'User',
      verificationUrl
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
      // User has been sent verification email but hasn't verified
      throw new Error('Please verify your email address before signing in. Check your inbox for a verification email.');
    }
  }
  
  const inputPasswordHash = hashPassword(password);

  // Primary path: use passwordHash
  if (user.passwordHash) {
    if (user.passwordHash !== inputPasswordHash) throw new Error('Invalid credentials');
  } else {
    // Backward compatibility: some legacy users only have `password` field
    const legacyPassword: string | undefined = (user as any).password;

    // If legacy password matches plaintext input OR hashed input, accept and upgrade
    const legacyMatches = legacyPassword === password || legacyPassword === inputPasswordHash;
    if (!legacyPassword || !legacyMatches) {
      throw new Error('Your account is missing a password hash. Please reset your password or contact support.');
    }

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
        passwordHash: inputPasswordHash, // Ensure passwordHash is always set
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
    vendorType: user.role === 'vendor' ? user.vendorInfo?.businessType : undefined,
    isEmailVerified: user.isEmailVerified || false,
    walletBalance
  };
}
