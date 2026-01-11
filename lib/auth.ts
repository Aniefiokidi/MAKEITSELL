
import { connectToDatabase } from './mongodb';
import mongoose from 'mongoose';
import crypto from 'crypto';

// User schema (minimal)
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  passwordHash: String,
  name: String,
  role: { type: String, default: 'customer' },
  vendorInfo: Object,
  sessionToken: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export async function signUp({ email, password, name, role, vendorInfo }: { email: string, password: string, name: string, role?: string, vendorInfo?: any }) {
  await connectToDatabase();
  const existing = await User.findOne({ email });
  if (existing) throw new Error('Email already in use');
  const passwordHash = hashPassword(password);
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const user = await User.create({
    email,
    passwordHash,
    name,
    role: role || 'customer',
    vendorInfo,
    sessionToken,
  });
  return { success: true, user: { id: user._id, email: user.email, name: user.name, role: user.role }, sessionToken };
}

export async function signIn({ email, password }: { email: string, password: string }) {
  await connectToDatabase();
  const user = await User.findOne({ email });
  console.log('[auth.signIn] User found:', user ? 'YES' : 'NO');
  if (!user) throw new Error('Invalid credentials');
  
  const inputPasswordHash = hashPassword(password);
  console.log('[auth.signIn] Stored hash:', user.passwordHash);
  console.log('[auth.signIn] Input hash:', inputPasswordHash);
  console.log('[auth.signIn] Hashes match:', user.passwordHash === inputPasswordHash);
  
  if (user.passwordHash !== inputPasswordHash) throw new Error('Invalid credentials');
  // Generate new session token
  user.sessionToken = crypto.randomBytes(32).toString('hex');
  console.log('[auth.signIn] Generated sessionToken:', user.sessionToken);
  await user.save();
  console.log('[auth.signIn] User saved with new sessionToken');
  return { success: true, user: { id: user._id, email: user.email, name: user.name, role: user.role }, sessionToken: user.sessionToken };
}

export async function getUserBySessionToken(sessionToken: string) {
  await connectToDatabase();
  console.log('[auth.getUserBySessionToken] Looking for user with token:', sessionToken.substring(0, 8) + '...');
  const user = await User.findOne({ sessionToken });
  console.log('[auth.getUserBySessionToken] User found:', user ? 'YES' : 'NO');
  if (!user) return null;
  return { id: user._id, email: user.email, name: user.name, role: user.role };
}
