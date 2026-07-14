
import { connectToDatabase } from './mongodb';
import crypto from 'crypto';
import { User } from './models/User';
import { hashPassword, needsPasswordRehash, verifyPassword } from './password';
import { normalizeNigerianPhone } from './sms';

function normalizeBooleanFlag(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true
    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === '') return false
  }

  return false
}

export async function signUp({ email, password, name, role, vendorInfo, riderInfo, phone, verificationChannel }: { email: string, password: string, name: string, role?: string, vendorInfo?: any, riderInfo?: any, phone?: string, verificationChannel?: 'email' }) {
  await connectToDatabase();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) throw new Error('Email already in use');
  
  const passwordHash = hashPassword(password);
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const normalizedPhone = phone ? normalizeNigerianPhone(phone) : null
  
  // Generate a 6-digit verification OTP code valid for 10 minutes.
  const emailVerificationToken = String(Math.floor(100000 + Math.random() * 900000));
  const emailVerificationTokenExpiry = new Date(Date.now() + 10 * 60 * 1000);
  
  const user = await User.create({
    email: normalizedEmail,
    passwordHash,
    name,
    phone,
    phone_number: normalizedPhone || phone,
    phone_verified: false,
    role: role || 'customer',
    walletBalance: 0,
    vendorInfo,
    riderInfo,
    sessionToken,
    isEmailVerified: false,
    emailVerificationToken,
    emailVerificationTokenExpiry,
  });

  // Send verification email
  try {
    const { emailService } = require('./email');
    let sent = await emailService.sendEmailVerification({
      email: user.email,
      name: user.name || 'User',
      verificationCode: emailVerificationToken
    });

    // One extra explicit retry path to avoid edge-case delivery misses.
    if (!sent) {
      sent = await emailService.sendEmailVerification({
        email: user.email,
        name: user.name || 'User',
        verificationCode: emailVerificationToken
      });
    }

    if (!sent) {
      throw new Error('VERIFICATION_EMAIL_SEND_FAILED');
    }

    console.log(`[auth.signUp] Verification email sent to: ${user.email}`);
  } catch (emailError) {
    console.error('[auth.signUp] Failed to send verification email:', emailError);
    const retryDelayMs = Number(process.env.VERIFICATION_RETRY_INITIAL_DELAY_MS || 2 * 60 * 1000);
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          verificationEmailRetryPending: true,
          verificationEmailRetryCount: 0,
          verificationEmailNextRetryAt: new Date(Date.now() + retryDelayMs),
          verificationEmailLastAttemptAt: new Date(),
          verificationEmailLastError: String((emailError as any)?.message || emailError || 'Unknown email send failure'),
          updatedAt: new Date(),
        }
      }
    );
    throw new Error('VERIFICATION_EMAIL_SEND_FAILED');
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
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) throw new Error('Invalid credentials');

  // Check email verification
  if (!user.isEmailVerified) {
    if (!user.emailVerificationToken || !user.emailVerificationTokenExpiry) {
      throw new Error('EMAIL_NOT_VERIFIED_LEGACY');
    } else {
      throw new Error('Please verify your email address before signing in. Check your inbox for your OTP code.');
    }
  }

  let shouldRehash = false
  // When true the user proved they know their pre-reset password, so skip the forced-change redirect.
  let skipForceChange = false

  // MIS- temp password bypass: all batch-issued temp passwords start with MIS-.
  // Hash verification failed due to a format mismatch from the batch script, so any
  // correctly-formatted MIS- password is accepted for accounts still pending a reset.
  const MIS_PATTERN = /^MIS-[0-9A-F]{8}$/
  const isMisPassword = MIS_PATTERN.test(password)
  const pendingReset = !!(user as any).mustChangePassword

  // Check previousPasswordHash first — saved before any admin mass-reset so old passwords keep working.
  const prevHash = String((user as any).previousPasswordHash || '')
  if (prevHash && verifyPassword(password, prevHash)) {
    skipForceChange = true
  } else if (isMisPassword && pendingReset) {
    // Accept the MIS- temp password and keep mustChangePassword: true so user is forced to set a new one.
    shouldRehash = false
  } else if (user.passwordHash) {
    if (!verifyPassword(password, user.passwordHash)) {
      if (pendingReset) {
        throw new Error('PASSWORD_WAS_RESET')
      }
      throw new Error('Invalid credentials')
    }
    shouldRehash = needsPasswordRehash(user.passwordHash)
  } else {
    // Backward compatibility: some legacy users only have `password` field
    const legacyPassword: string | undefined = (user as any).password;
    const legacyMatches = !!legacyPassword && (
      legacyPassword === password || verifyPassword(password, legacyPassword)
    );
    if (!legacyMatches) {
      throw new Error('Your account is missing a password hash. Please reset your password or contact support.');
    }
    shouldRehash = true
  }

  const newSessionToken = crypto.randomBytes(32).toString('hex');
  let walletBalance = typeof (user as any).walletBalance === 'number' ? (user as any).walletBalance : 0;

  const mongoose = require('mongoose');
  const db = mongoose.connection.db;

  const setFields: Record<string, any> = {
    sessionToken: newSessionToken,
    walletBalance,
    updatedAt: new Date(),
  }
  if (shouldRehash) setFields.passwordHash = hashPassword(password)
  // If the user proved their old password, clear the saved hash and lift the forced-change flag.
  if (skipForceChange) setFields.mustChangePassword = false
  const updateOp: Record<string, any> = { $set: setFields }
  if (skipForceChange) updateOp.$unset = { previousPasswordHash: '' }

  await db.collection('users').updateOne({ email: normalizedEmail }, updateOp);

  return {
    success: true,
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      mustChangePassword: skipForceChange ? false : !!(user as any).mustChangePassword,
      phone: (user as any).phone,
      phone_number: (user as any).phone_number,
      phone_verified: normalizeBooleanFlag((user as any).phone_verified),
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
    mustChangePassword: !!(user as any).mustChangePassword,
    phone: (user as any).phone,
    phone_number: (user as any).phone_number,
    phone_verified: normalizeBooleanFlag((user as any).phone_verified),
    address: (user as any).address,
    city: (user as any).city,
    state: (user as any).state,
    postalCode: (user as any).postalCode,
    vendorType: user.role === 'vendor' ? user.vendorInfo?.businessType : undefined,
    isEmailVerified: user.isEmailVerified || false,
    walletBalance
  };
}
