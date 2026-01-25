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

// Sign up new user (calls API route)
export const signUp = async (
  email: string,
  password: string,
  displayName: string,
  role: "customer" | "vendor" | "admin" = "customer",
  vendorType?: "goods" | "services" | "both"
) => {
  try {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        name: displayName,
        role: role === "admin" ? "customer" : role,
        vendorType
      }),
    });
    const result = await response.json();
    if (result.success && result.user && result.sessionToken) {
      // Session is managed by HTTP-only cookie only
      return {
        user: {
          uid: result.user.id,
          email: result.user.email,
          displayName: result.user.name,
          role: result.user.role
        },
        userProfile: {
          uid: result.user.id,
          email: result.user.email,
          displayName: result.user.name,
          role: result.user.role,
          vendorType: result.user.role === 'vendor' ? (vendorType || 'both') : undefined,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };
    } else {
      throw new Error(result.error || 'Failed to create account');
    }
  } catch (error: any) {
    throw new Error(error.message || 'Failed to create account. Please try again.');
  }
};

// Sign in user (calls API route)
export const signIn = async (email: string, password: string) => {
  try {
    const response = await fetch('/api/auth/signin', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const result = await response.json();
    if (result.success && result.user && result.sessionToken) {
      // Store session token in sessionStorage as backup
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('sessionToken', result.sessionToken)
        console.log('[signIn] Stored sessionToken in sessionStorage')
      }
      // Session is also managed by HTTP-only cookie
      return {
        user: {
          uid: result.user.id,
          email: result.user.email,
          displayName: result.user.name,
          role: result.user.role
        },
        userProfile: {
          uid: result.user.id,
          email: result.user.email,
          displayName: result.user.name,
          role: result.user.role,
          vendorType: result.user.role === 'vendor' ? 'both' : undefined,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };
    } else {
      throw new Error(result.error || 'Authentication failed');
    }
  } catch (error: any) {
    throw new Error('Sign in failed. Please check your credentials and try again.');
  }
};

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