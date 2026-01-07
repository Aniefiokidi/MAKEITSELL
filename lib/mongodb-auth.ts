import connectToDatabase from './mongodb'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

// User Schema for MongoDB authentication
export interface IUser extends Document {
  email: string
  password: string
  name: string
  role: "customer" | "vendor" | "admin"
  isEmailVerified: boolean
  profile: {
    phone?: string
    address?: string
    avatar?: string
    bio?: string
  }
  vendorInfo?: {
    businessName: string
    businessType: string
    taxId?: string
    bankAccount?: string
  }
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new mongoose.Schema<IUser>({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { 
    type: String, 
    enum: ["customer", "vendor", "admin"],
    default: "customer"
  },
  isEmailVerified: { type: Boolean, default: false },
  profile: {
    phone: { type: String },
    address: { type: String },
    avatar: { type: String },
    bio: { type: String }
  },
  vendorInfo: {
    businessName: { type: String },
    businessType: { type: String },
    taxId: { type: String },
    bankAccount: { type: String }
  }
}, {
  timestamps: true,
  collection: 'users'
})

// Hash password before saving
UserSchema.pre('save', async function() {
  if (!this.isModified('password')) return
  
  try {
    const salt = await bcrypt.genSalt(12)
    this.password = await bcrypt.hash(this.password, salt)
  } catch (error: any) {
    throw error
  }
})

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password)
}

// email index already created by unique: true

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema)

// Session Schema for managing user sessions
export interface ISession extends Document {
  userId: string
  email: string
  role: string
  name: string
  sessionToken: string
  expiresAt: Date
  createdAt: Date
}

const SessionSchema = new mongoose.Schema<ISession>({
  userId: { type: String, required: true },
  email: { type: String, required: true },
  role: { type: String, required: true },
  name: { type: String, required: true },
  sessionToken: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true }
}, {
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'sessions'
})

// sessionToken index already created by unique: true
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }) // Auto-delete expired sessions

export const Session = mongoose.models.Session || mongoose.model<ISession>('Session', SessionSchema)

// Helper function to generate session token
function generateSessionToken(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15)
}

// Authentication functions
export const signUp = async (userData: {
  email: string
  password: string
  name: string
  role?: "customer" | "vendor"
  vendorInfo?: any
}) => {
  try {
    await connectToDatabase()

    // Check if user already exists
    const existingUser = await User.findOne({ email: userData.email.toLowerCase() })
    if (existingUser) {
      throw new Error("User already exists with this email")
    }

    // Create new user
    const user = new User({
      email: userData.email.toLowerCase(),
      password: userData.password,
      name: userData.name,
      role: userData.role || "customer",
      vendorInfo: userData.vendorInfo
    })

    const savedUser = await user.save()

    // Create session
    const sessionToken = generateSessionToken()
    const session = new Session({
      userId: savedUser._id.toString(),
      email: savedUser.email,
      role: savedUser.role,
      name: savedUser.name,
      sessionToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    })

    await session.save()

    return {
      success: true,
      user: {
        id: savedUser._id.toString(),
        email: savedUser.email,
        name: savedUser.name,
        role: savedUser.role
      },
      sessionToken
    }
  } catch (error: any) {
    console.error("MongoDB signup error:", error)
    throw new Error(error.message || "Failed to create account")
  }
}

export const signIn = async (email: string, password: string) => {
  try {
    await connectToDatabase()

    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) {
      throw new Error("Invalid email or password")
    }

    const isPasswordValid = await (user as any).comparePassword(password)
    if (!isPasswordValid) {
      throw new Error("Invalid email or password")
    }

    // Create session
    const sessionToken = generateSessionToken()
    const session = new Session({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
      sessionToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    })

    await session.save()

    return {
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role
      },
      sessionToken
    }
  } catch (error: any) {
    console.error("MongoDB signin error:", error)
    throw new Error(error.message || "Failed to sign in")
  }
}

export const signOut = async (sessionToken?: string) => {
  try {
    if (sessionToken) {
      await connectToDatabase()
      await Session.deleteOne({ sessionToken })
    }

    return { success: true }
  } catch (error: any) {
    console.error("MongoDB signout error:", error)
    return { success: true }
  }
}

export const getCurrentUser = async (sessionToken?: string) => {
  try {
    if (!sessionToken) {
      return { success: false, user: null }
    }

    // Check MongoDB session
    await connectToDatabase()
    
    const session = await Session.findOne({
      sessionToken,
      expiresAt: { $gt: new Date() }
    })

    if (!session) {
      return { success: false, user: null }
    }

    return {
      success: true,
      user: {
        id: session.userId,
        email: session.email,
        name: session.name,
        role: session.role
      }
    }
  } catch (error: any) {
    console.error("Get current user error:", error)
    
    // Fallback to mock session check
    if (typeof window !== "undefined") {
      const mockSession = localStorage.getItem("mockSession")
      if (mockSession) {
        const session = JSON.parse(mockSession)
        if (session.expiresAt > Date.now()) {
          return { success: true, user: session.user }
        }
      }
    }
    
    return { success: false, user: null }
  }
}

export const updateUserProfile = async (userId: string, profileData: any) => {
  try {
    await connectToDatabase()
    
    await User.findByIdAndUpdate(userId, { 
      $set: { 
        profile: profileData,
        updatedAt: new Date()
      }
    }, { new: true })

    return { success: true }
  } catch (error: any) {
    console.error("Update profile error:", error)
    throw new Error("Failed to update profile")
  }
}

export const getUserById = async (userId: string) => {
  try {
    await connectToDatabase()
    
    const user = await User.findById(userId).select('-password').lean().exec()
    if (!user) {
      throw new Error("User not found")
    }

    return user
  } catch (error: any) {
    console.error("Get user error:", error)
    throw new Error("Failed to get user")
  }
}

// Utility functions
export const isMongoAuthAvailable = async (): Promise<boolean> => {
  try {
    await connectToDatabase()
    return true
  } catch (error) {
    console.warn("MongoDB authentication is not available:", error)
    return false
  }
}

export const withMongoAuthRetry = async <T>(
  operation: () => Promise<T>,
  fallback: () => T
): Promise<T> => {
  try {
    return await operation()
  } catch (error: any) {
    if (error.message?.includes("ENOTFOUND") || error.message?.includes("ECONNREFUSED")) {
      console.log("MongoDB unavailable for auth, using fallback")
      return fallback()
    }
    throw error
  }
}