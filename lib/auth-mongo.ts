// MongoDB Authentication - Drop-in replacement for Firebase Auth
import * as mongoAuth from './mongodb-auth'

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  role: "customer" | "vendor" | "admin" | "csa"
  vendorType?: "goods" | "services" | "both"
  createdAt: Date
  updatedAt: Date
}

// Sign up new user
export const signUp = async (
  email: string,
  password: string,
  displayName: string,
  role: "customer" | "vendor" | "admin" = "customer",
  vendorType?: "goods" | "services" | "both"
) => {
  console.log("Starting MongoDB signup for:", email)

  try {
    const vendorInfo = role === "vendor" ? {
      businessName: displayName,
      businessType: vendorType || "both"
    } : undefined

    const result = await mongoAuth.signUp({
      email,
      password,
      name: displayName,
      role: role === "admin" ? "customer" : role,
      vendorInfo
    })

    const userProfile: UserProfile = {
      uid: result.user.id,
      email: result.user.email,
      displayName: result.user.name,
      role: result.user.role as any,
      vendorType: role === "vendor" ? (vendorType || "both") : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Store session token for future requests
    if (typeof window !== 'undefined') {
      localStorage.setItem('sessionToken', result.sessionToken)
      localStorage.setItem('currentUser', JSON.stringify({
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        type: result.user.role
      }))
    }

    console.log("MongoDB signup successful for:", email)
    return { 
      user: {
        uid: result.user.id,
        email: result.user.email,
        displayName: result.user.name,
        role: result.user.role
      }, 
      userProfile 
    }
  } catch (error: any) {
    console.error("MongoDB Sign up error:", error)
    
    // Provide user-friendly error messages
    if (error.message?.includes("already exists")) {
      throw new Error("This email is already registered. Please use a different email or try logging in.")
    } else if (error.message?.includes("ENOTFOUND") || error.message?.includes("ECONNREFUSED")) {
      throw new Error("Database connection failed. Please try again later.")
    } else {
      throw new Error(error.message || "Failed to create account. Please try again.")
    }
  }
}

// Sign in user with MongoDB
export const signIn = async (email: string, password: string) => {
  try {
    const result = await mongoAuth.signIn(email, password)

    if (result.success) {
      const userProfile: UserProfile = {
        uid: result.user.id,
        email: result.user.email,
        displayName: result.user.name,
        role: result.user.role as any,
        vendorType: result.user.role === 'vendor' ? 'both' : undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Store session token
      if (typeof window !== 'undefined') {
        localStorage.setItem('sessionToken', result.sessionToken)
        localStorage.setItem('currentUser', JSON.stringify({
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          type: result.user.role
        }))
      }

      return {
        user: {
          uid: result.user.id,
          email: result.user.email,
          displayName: result.user.name,
          role: result.user.role,
        },
        userProfile,
      }
    }

    throw new Error("Authentication failed")
  } catch (error: any) {
    console.error("MongoDB authentication error:", error)
    
    // Provide user-friendly error messages
    if (error.message?.includes("ENOTFOUND") || error.message?.includes("ECONNREFUSED")) {
      throw new Error("Database connection failed. Please check your internet connection.")
    } else if (error.message?.includes("Invalid email or password")) {
      throw new Error("Invalid email or password.")
    } else {
      throw new Error("Sign in failed. Please check your credentials and try again.")
    }
  }
}

// Sign out user
export const logOut = async () => {
  try {
    const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('sessionToken') : null
    
    if (sessionToken) {
      await mongoAuth.signOut(sessionToken)
    }
  } catch (error) {
    console.warn("MongoDB signout error:", error)
  }

  // Always clear local storage
  if (typeof window !== 'undefined') {
    localStorage.removeItem('currentUser')
    localStorage.removeItem('sessionToken')
  }
}

// Get current user from localStorage or MongoDB session
export const getCurrentUser = async () => {
  if (typeof window !== 'undefined') {
    const storedUser = localStorage.getItem('currentUser')
    if (storedUser) {
      return JSON.parse(storedUser)
    }

    const sessionToken = localStorage.getItem('sessionToken')
    if (sessionToken) {
      try {
        const result = await mongoAuth.getCurrentUser(sessionToken)
        if (result.success && result.user) {
          // Update localStorage
          localStorage.setItem('currentUser', JSON.stringify({
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            type: result.user.role
          }))
          return {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            type: result.user.role
          }
        }
      } catch (error) {
        console.warn("Failed to get current user from MongoDB:", error)
      }
    }
  }
  
  return null
}

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    if (uid.startsWith('mock-')) {
      // Handle mock users
      const currentUser = await getCurrentUser()
      if (currentUser) {
        return {
          uid,
          email: currentUser.email,
          displayName: currentUser.name,
          role: currentUser.type === 'vendor' ? 'vendor' : 'customer',
          vendorType: currentUser.type === 'vendor' ? 'both' : undefined,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      }
      return null
    }

    const user = await mongoAuth.getUserById(uid)
    if (user) {
      return {
        uid: user._id.toString(),
        email: user.email,
        displayName: user.name,
        role: user.role as any,
        vendorType: user.role === 'vendor' ? 'both' : undefined,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    }

    return null
  } catch (error: any) {
    console.warn("Error getting user profile:", error)
    return null
  }
}

// Additional MongoDB-specific functions
export const updateUserProfile = async (uid: string, profileData: any) => {
  try {
    if (uid.startsWith('mock-')) {
      // Handle mock users - just update localStorage
      const currentUser = getCurrentUser()
      if (currentUser && typeof window !== 'undefined') {
        const updatedUser = { ...currentUser, ...profileData }
        localStorage.setItem('currentUser', JSON.stringify(updatedUser))
        return { success: true }
      }
      return { success: false }
    }

    await mongoAuth.updateUserProfile(uid, profileData)
    return { success: true }
  } catch (error) {
    console.error("Error updating user profile:", error)
    throw error
  }
}

// Auth utilities
export const isAuthAvailable = async (): Promise<boolean> => {
  return await mongoAuth.isMongoAuthAvailable()
}

// For backward compatibility
export const auth = null // MongoDB doesn't have a direct auth instance