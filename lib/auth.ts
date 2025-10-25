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
  const authInstance = getAuthInstance()
  const db = getDbInstance()

  if (!authInstance) {
    throw new Error("Auth not available in server environment")
  }

  try {
    const userCredential = await signInWithEmailAndPassword(authInstance, email, password)
    const user = userCredential.user

    const userProfile = await getUserProfile(user.uid)

    return {
      user: {
        ...user,
        role: userProfile?.role || "customer",
      },
      userProfile,
    }
  } catch (error: any) {
    console.error("Sign in error:", error)
    
    // Provide user-friendly error messages
    if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password" || error.code === "auth/user-not-found") {
      throw new Error("Invalid email or password. Please check your credentials and try again.")
    } else if (error.code === "auth/invalid-email") {
      throw new Error("Invalid email address. Please enter a valid email.")
    } else if (error.code === "auth/user-disabled") {
      throw new Error("This account has been disabled. Please contact support.")
    } else if (error.code === "auth/network-request-failed") {
      throw new Error("Network error. Please check your internet connection and try again.")
    } else if (error.code === "auth/too-many-requests") {
      throw new Error("Too many failed login attempts. Please try again later.")
    } else {
      throw new Error(error.message || "Failed to sign in. Please try again.")
    }
  }
}

// Sign out user
export const logOut = async () => {
  const authInstance = getAuthInstance()

  if (!authInstance) {
    throw new Error("Auth not available in server environment")
  }

  try {
    await signOut(authInstance)
  } catch (error: any) {
    console.error("Sign out error:", error)
    throw new Error(error.message || "Failed to sign out. Please try again.")
  }
}


export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const db = getDbInstance()

  try {
    const docRef = doc(db, "users", uid)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      return docSnap.data() as UserProfile
    } else {
      return null
    }
  } catch (error) {
    console.error("Error getting user profile:", error)
    return null
  }
}
