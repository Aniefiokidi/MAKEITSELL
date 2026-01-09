"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { getUserProfile, type UserProfile, signIn, signUp, logOut } from "@/lib/auth-client"

// Updated User interface for MongoDB
interface User {
  uid: string
  email: string
  displayName: string
  role: "customer" | "vendor" | "admin"
}

interface AuthContextType {
  user: User | null
  userProfile: UserProfile | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ user: User; userProfile: UserProfile | null }>
  register: (
    email: string,
    password: string,
    displayName: string,
    role?: "customer" | "vendor",
  ) => Promise<{ user: User; userProfile: UserProfile }>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  login: async () => {
    throw new Error("AuthProvider not initialized")
  },
  register: async () => {
    throw new Error("AuthProvider not initialized")
  },
  logout: async () => {
    throw new Error("AuthProvider not initialized")
  },
})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  // Inactivity timer
  const INACTIVITY_LIMIT = 40 * 60 * 1000; // 40 minutes in ms
  let inactivityTimeout: ReturnType<typeof setTimeout> | null = null;

  // Reset inactivity timer
  const resetInactivityTimer = () => {
    if (inactivityTimeout) clearTimeout(inactivityTimeout);
    inactivityTimeout = setTimeout(() => {
      logout();
    }, INACTIVITY_LIMIT);
  };

  useEffect(() => {
    if (!user) return;
    // Events that count as activity
    const events = ["mousemove", "keydown", "scroll", "touchstart", "click"];
    events.forEach((event) => window.addEventListener(event, resetInactivityTimer));
    resetInactivityTimer();
    return () => {
      if (inactivityTimeout) clearTimeout(inactivityTimeout);
      events.forEach((event) => window.removeEventListener(event, resetInactivityTimer));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Handle hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    // Only run on client-side
    if (typeof window === "undefined") {
      setLoading(false)
      return
    }

    // Check for existing session using HTTP-only cookie
    const checkAuth = async () => {
      try {
        console.log('[AuthContext] Checking session on mount');
        const res = await fetch('/api/auth/me', { credentials: 'include' })
        console.log('[AuthContext] /api/auth/me response status:', res.status);
        const data = await res.json()
        console.log('[AuthContext] /api/auth/me data:', data);
        if (data.user) {
          console.log('[AuthContext] User found, setting to:', data.user.email);
          setUser({
            uid: data.user.id,
            email: data.user.email,
            displayName: data.user.name,
            role: data.user.role
          })
          // Fallback: if API does not return userProfile, derive a minimal one
          const derivedProfile = data.userProfile || {
            uid: data.user.id,
            email: data.user.email,
            displayName: data.user.name,
            role: data.user.role,
            vendorType: data.user.role === 'vendor' ? 'both' : undefined,
            createdAt: new Date(),
            updatedAt: new Date()
          }
          setUserProfile(derivedProfile)
        } else {
          console.log('[AuthContext] No user found, logging out');
          setUser(null)
          setUserProfile(null)
        }
      } catch (error) {
        console.log('[AuthContext] Error checking session:', error);
        setUser(null)
        setUserProfile(null)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = async (email: string, password: string): Promise<{ user: User; userProfile: UserProfile | null }> => {
    try {
      setLoading(true)
      const result = await signIn(email, password)
      setUser(result.user)
      // Fix vendorType type
      const allowedVendorTypes = ["goods", "services", "both"];
      const safeVendorType = allowedVendorTypes.includes(result.userProfile.vendorType as any)
        ? (result.userProfile.vendorType as "goods" | "services" | "both")
        : undefined;
      setUserProfile({
        ...result.userProfile,
        vendorType: safeVendorType,
      });
      return { user: result.user, userProfile: { ...result.userProfile, vendorType: safeVendorType } };
    } catch (error) {
      throw error;
    } finally {
      setLoading(false)
    }
  }

  const register = async (
    email: string,
    password: string,
    displayName: string,
    role: "customer" | "vendor" = "customer",
  ): Promise<{ user: User; userProfile: UserProfile }> => {
    try {
      setLoading(true)
      const result = await signUp(email, password, displayName, role)
      setUser(result.user)
      // Fix vendorType type
      const allowedVendorTypes = ["goods", "services", "both"];
      const safeVendorType = allowedVendorTypes.includes(result.userProfile.vendorType as any)
        ? (result.userProfile.vendorType as "goods" | "services" | "both")
        : undefined;
      setUserProfile({
        ...result.userProfile,
        vendorType: safeVendorType,
      });
      return { user: result.user, userProfile: { ...result.userProfile, vendorType: safeVendorType } };
    } catch (error) {
      throw error;
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      await logOut()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Always clear state regardless of API call success
      setUser(null)
      setUserProfile(null)
      
      // Ensure localStorage is cleared
      // No need to clear localStorage; session is managed by HTTP-only cookie
    }
  }

  // Handle hydration mismatch
  if (!mounted) {
    return (
      <AuthContext.Provider value={{ user: null, userProfile: null, loading: true, login, register, logout }}>
        {children}
      </AuthContext.Provider>
    )
  }

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
