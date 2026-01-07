import { getAuthInstance, getDbInstance } from "./firebase"
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from "firebase/auth"
import { doc, setDoc, getDoc } from "firebase/firestore"

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  role: "customer" | "vendor" | "admin" | "csa"
  vendorType?: "goods" | "services" | "both" // For vendors: what they offer
  createdAt: Date
  updatedAt: Date
}

export const auth = getAuthInstance()

// Sign up new user
export const signUp = async (
  email: string,
  password: string,
  displayName: string,
  role: "customer" | "vendor" | "admin" = "customer",
  vendorType?: "goods" | "services" | "both"
) => {
  const authInstance = getAuthInstance()
  const db = getDbInstance()

  if (!authInstance) {
    throw new Error("Auth not available in server environment")
  }

  console.log("Starting signup for:", email)

  try {
    console.log("Creating user with email and password...")
    const userCredential = await createUserWithEmailAndPassword(authInstance, email, password)
    const user = userCredential.user
    console.log("User created successfully:", user.uid)

    // Update user profile
    console.log("Updating user profile...")
    await updateProfile(user, { displayName })

    // Create user document in Firestore
    const userProfile: UserProfile = {
      uid: user.uid,
      email: user.email!,
      displayName,
      role,
      vendorType: role === "vendor" ? (vendorType || "both") : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    console.log("Creating user document in Firestore...")
    await setDoc(doc(db, "users", user.uid), userProfile)
    console.log("User document created successfully")

    return { user, userProfile }
  } catch (error: any) {
    console.error("Sign up error:", error)
    
    // Provide user-friendly error messages
    if (error.code === "auth/email-already-in-use") {
      throw new Error("This email is already registered. Please use a different email or try logging in.")
    } else if (error.code === "auth/invalid-email") {
      throw new Error("Invalid email address. Please enter a valid email.")
    } else if (error.code === "auth/weak-password") {
      throw new Error("Password is too weak. Please use a stronger password.")
    } else if (error.code === "auth/network-request-failed") {
      throw new Error("Network error. Please check your internet connection and try again.")
    } else {
      throw new Error(error.message || "Failed to create account. Please try again.")
    }
  }
}

// Sign in user
export const signIn = async (email: string, password: string) => {
  try {
    // Use MongoDB authentication
    console.log("Using MongoDB authentication for user:", email)
    
    // Use the MongoDB auth system
    const mongoAuth = await import('./mongodb-auth')
    const result = await mongoAuth.signIn(email, password)
    
    if (result && result.user && result.sessionToken) {
      // Store user session in localStorage for persistence
      localStorage.setItem('currentUser', JSON.stringify(result.user))
      localStorage.setItem('sessionToken', result.sessionToken)
      
      return {
        user: {
          uid: result.user.id,
          email: result.user.email,
          displayName: result.user.name,
          role: result.user.role,
        },
        userProfile: {
          uid: result.user.id,
          email: result.user.email,
          displayName: result.user.name,
          role: result.user.role,
          vendorType: result.user.role === 'vendor' ? 'both' : undefined,
          createdAt: new Date(),
          updatedAt: new Date()
        },
      }
    }
    
    throw new Error("Authentication failed")
  } catch (mongoError: any) {
    console.log("MongoDB authentication failed:", mongoError.message)
    throw mongoError
  }
}

// Sign out user
export const logOut = async () => {
  try {
    // Clear localStorage session
    localStorage.removeItem('currentUser')
    localStorage.removeItem('sessionToken')
    localStorage.removeItem('authToken')
    console.log("User signed out successfully")
  } catch (error: any) {
    console.error("Sign out error:", error)
    throw new Error(error.message || "Failed to sign out. Please try again.")
  }
}

// Get current user from localStorage 
export const getCurrentUser = () => {
  try {
    const userStr = localStorage.getItem('currentUser')
    return userStr ? JSON.parse(userStr) : null
  } catch {
    return null
  }
}

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    // Use MongoDB to get user profile
    const mongoAuth = await import('./mongodb-auth')
    const user = await mongoAuth.getUserById(uid)
    if (user) {
      return {
        uid: user._id.toString(),
        email: user.email,
        displayName: user.name,
        role: user.role,
        vendorType: user.role === 'vendor' ? 'both' : undefined,
        createdAt: user.createdAt || new Date(),
        updatedAt: user.updatedAt || new Date()
      }
    }
    return null
  } catch (error: any) {
    console.warn("Error getting user profile:", error)
    return null
  }
}
