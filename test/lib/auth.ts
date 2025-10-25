import { getAuthInstance, getDbInstance } from "./firebase"
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from "firebase/auth"
import { doc, setDoc, getDoc } from "firebase/firestore"

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  role: "customer" | "vendor" | "admin" | "csa"
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
) => {
  const authInstance = getAuthInstance()
  const db = getDbInstance()

  if (!authInstance) {
    throw new Error("Auth not available in server environment")
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(authInstance, email, password)
    const user = userCredential.user

    // Update user profile
    await updateProfile(user, { displayName })

    // Create user document in Firestore
    const userProfile: UserProfile = {
      uid: user.uid,
      email: user.email!,
      displayName,
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await setDoc(doc(db, "users", user.uid), userProfile)

    return { user, userProfile }
  } catch (error) {
    throw error
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
  } catch (error) {
    throw error
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
  } catch (error) {
    throw error
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
