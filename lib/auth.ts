

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  role: "customer" | "vendor" | "admin" | "csa"
  vendorType?: "goods" | "services" | "both" // For vendors: what they offer
  createdAt: Date
  updatedAt: Date
}




// Sign up new user (MongoDB only)
export const signUp = async (userData: {
  email: string;
  password: string;
  displayName: string;
  role?: "customer" | "vendor" | "admin";
  vendorType?: "goods" | "services" | "both";
}) => {
  const mongoAuth = await import('./mongodb-auth');
  return mongoAuth.signUp({
    email: userData.email,
    password: userData.password,
    name: userData.displayName,
    role: userData.role === 'admin' ? 'customer' : userData.role,
    vendorInfo: userData.vendorType ? { vendorType: userData.vendorType } : undefined
  });
};

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
