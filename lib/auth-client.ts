// Client-side authentication - API wrapper for MongoDB auth
// This file provides the same interface as auth.ts but uses API routes

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
  console.log("Starting API signup for:", email)

  try {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        name: displayName,
        role: role === "admin" ? "customer" : role,
        vendorType
      }),
    })

    const result = await response.json()

    if (result.success) {
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
          role: result.user.role // Fixed: was 'type', should be 'role'
        }))
      }

      console.log("API signup successful for:", email)
      return { 
        user: {
          uid: result.user.id,
          email: result.user.email,
          displayName: result.user.name,
          role: result.user.role
        }, 
        userProfile 
      }
    } else {
      throw new Error(result.error || "Failed to create account")
    }
  } catch (error: any) {
    console.error("API Sign up error:", error)
    throw new Error(error.message || "Failed to create account. Please try again.")
  }
}

// Sign in user
export const signIn = async (email: string, password: string) => {
  console.log("Starting API signin for:", email)

  try {
    const response = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    const result = await response.json()

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

      // Store session data
      if (typeof window !== 'undefined') {
        localStorage.setItem('sessionToken', result.sessionToken)
        localStorage.setItem('currentUser', JSON.stringify({
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role // Fixed: was 'type', should be 'role'
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
    } else {
      throw new Error(result.error || "Authentication failed")
    }
  } catch (error: any) {
    console.error("API authentication error:", error)
    throw new Error("Sign in failed. Please check your credentials and try again.")
  }
}

// Sign out user
export const logOut = async () => {
  try {
    // Call API to invalidate session (no body needed, cookie is sent automatically)
    await fetch('/api/auth/signout', {
      method: 'POST',
      credentials: 'include'
    })
  } catch (error) {
    console.warn("API signout error:", error)
  }

  // Always clear local storage
  if (typeof window !== 'undefined') {
    localStorage.removeItem('currentUser')
    localStorage.removeItem('sessionToken')
  }
}

// Get current user from localStorage
export const getCurrentUser = () => {
  if (typeof window !== 'undefined') {
    const storedUser = localStorage.getItem('currentUser')
    if (storedUser) {
      return JSON.parse(storedUser)
    }
  }
  
  return null
}

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    if (uid.startsWith('mock-')) {
      // Handle mock users
      const currentUser = getCurrentUser()
      if (currentUser) {
        return {
          uid,
          email: currentUser.email,
          displayName: currentUser.name,
          role: currentUser.role || 'customer',
          vendorType: currentUser.role === 'vendor' ? 'both' : undefined,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      }
      return null
    }

    // For real users, we would call an API endpoint here
    // For now, construct from stored user data
    const currentUser = getCurrentUser()
    if (currentUser && currentUser.id === uid) {
      return {
        uid,
        email: currentUser.email,
        displayName: currentUser.name,
        role: currentUser.role || 'customer',
        vendorType: currentUser.role === 'vendor' ? 'both' : undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }

    return null
  } catch (error: any) {
    console.warn("Error getting user profile:", error)
    return null
  }
}

// Get session token for API requests
export const getSessionToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('sessionToken')
  }
  return null
}

// For backward compatibility
export const auth = null