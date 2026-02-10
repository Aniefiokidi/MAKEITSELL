
import { connectToDatabase } from './mongodb';
import crypto from 'crypto';
import { User } from './models/User';

function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export async function signUp({ email, password, name, role, vendorInfo }: { email: string, password: string, name: string, role?: string, vendorInfo?: any }) {
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
    role: role || 'customer',
    vendorInfo,
    sessionToken,
    isEmailVerified: false,
    emailVerificationToken,
    emailVerificationTokenExpiry,
  });

  // Send verification email
  try {
    const { emailService } = require('./email');
    const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.makeitsell.org';
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

  return { success: true, user: { id: user._id, email: user.email, name: user.name, role: user.role }, sessionToken };
}

export async function signIn({ email, password }: { email: string, password: string }) {
  await connectToDatabase();
  const user = await User.findOne({ email });
  console.log('[auth.signIn] User found:', user ? 'YES' : 'NO');
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
    console.log('[auth.signIn] Stored hash:', user.passwordHash);
    console.log('[auth.signIn] Input hash:', inputPasswordHash);
    console.log('[auth.signIn] Hashes match:', user.passwordHash === inputPasswordHash);
    if (user.passwordHash !== inputPasswordHash) throw new Error('Invalid credentials');
  } else {
    // Backward compatibility: some legacy users only have `password` field
    console.log('[auth.signIn] No passwordHash; attempting legacy password check');
    const legacyPassword: string | undefined = (user as any).password;

    // If legacy password matches plaintext input OR hashed input, accept and upgrade
    const legacyMatches = legacyPassword === password || legacyPassword === inputPasswordHash;
    if (!legacyPassword || !legacyMatches) {
      throw new Error('Your account is missing a password hash. Please reset your password or contact support.');
    }

    console.log('[auth.signIn] Legacy password accepted; upgrading to passwordHash');
  }
  
  // Generate new session token
  const newSessionToken = crypto.randomBytes(32).toString('hex');
  console.log('[auth.signIn] Generated sessionToken:', newSessionToken);
  
  // Use direct database update instead of Mongoose save to avoid document issues
  const mongoose = require('mongoose');
  const db = mongoose.connection.db;
  
  const updateResult = await db.collection('users').updateOne(
    { email: email },
    { 
      $set: { 
        sessionToken: newSessionToken,
        passwordHash: inputPasswordHash, // Ensure passwordHash is always set
        updatedAt: new Date()
      } 
    }
  );
  
  console.log('[auth.signIn] Direct update result:', updateResult.modifiedCount > 0 ? 'SUCCESS' : 'FAILED');
  
  return { 
    success: true, 
    user: { 
      id: user._id, 
      email: user.email, 
      name: user.name, 
      role: user.role 
    }, 
    sessionToken: newSessionToken 
  };
}

export async function getUserBySessionToken(sessionToken: string) {
  await connectToDatabase();
  console.log('[auth.getUserBySessionToken] Looking for user with token:', sessionToken.substring(0, 8) + '...');
  const user = await User.findOne({ sessionToken });
  console.log('[auth.getUserBySessionToken] User found:', user ? 'YES' : 'NO');
  if (!user) return null;
  return { 
    id: user._id, 
    email: user.email, 
    name: user.name, 
    role: user.role,
    isEmailVerified: user.isEmailVerified || false
  };
}
