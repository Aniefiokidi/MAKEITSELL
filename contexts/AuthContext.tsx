"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { getUserProfile, type UserProfile, signIn, signUp, logOut } from "@/lib/auth-client"

// Updated User interface for MongoDB
interface User {
  uid: string
  email: string
  displayName: string
  role: "customer" | "vendor" | "admin" | "csa"
}

interface AuthContextType {
  user: User | null
  userProfile: UserProfile | null
  loading: boolean
  refreshProfile: () => Promise<void>
  login: (email: string, password: string) => Promise<{ user: User; userProfile: UserProfile | null }>
  register: (
    email: string,
    password: string,
    displayName: string,
    role?: "customer" | "vendor",
    phone?: string,
    vendorType?: "goods" | "services" | "both",
    verificationChannel?: "email",
  ) => Promise<{ user: User; userProfile: UserProfile }>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  refreshProfile: async () => {
    throw new Error("AuthProvider not initialized")
  },
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

const normalizeBooleanFlag = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true
    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === '') return false
  }

  return false
}

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

  const refreshProfile = async () => {
    if (typeof window === "undefined") return

    try {
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!res.ok) return

      const data = await res.json()
      if (!data?.user) return

      const safeVendorType =
        data.user?.vendorType === 'goods' ||
        data.user?.vendorType === 'services' ||
        data.user?.vendorType === 'both'
          ? data.user.vendorType
          : undefined
      const normalizedPhoneVerified = normalizeBooleanFlag(
        data?.userProfile?.phoneVerified ?? data?.user?.phone_verified ?? data?.user?.phoneVerified
      )

      const derivedProfile = data.userProfile || {
        uid: data.user.id,
        email: data.user.email,
        displayName: data.user.name,
        role: data.user.role,
        mustChangePassword: !!data.user.mustChangePassword,
        phone: data.user.phone,
        phoneNumber: data.user.phone_number,
        phoneVerified: normalizedPhoneVerified,
        vendorType: data.user.role === 'vendor' ? safeVendorType : undefined,
        walletBalance: typeof data.user.walletBalance === 'number' ? data.user.walletBalance : 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      derivedProfile.phoneVerified = normalizedPhoneVerified

      setUserProfile(derivedProfile)
    } catch (error) {
      console.error('[AuthContext] Failed to refresh profile:', error)
    }
  }

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

        const res = await fetch('/api/auth/me', { 
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          }
        })
        console.log('[AuthContext] /api/auth/me response status:', res.status);
        
        if (!res.ok) {
          console.log('[AuthContext] Auth check returned non-200 status:', res.status);
          setUser(null)
          setUserProfile(null)
          setLoading(false)
          return
        }

        const data = await res.json()
        console.log('[AuthContext] /api/auth/me data:', data);
        
        if (data.user) {
          console.log('[AuthContext] User found, setting to:', data.user.email);
          const safeVendorType =
            data.user?.vendorType === 'goods' ||
            data.user?.vendorType === 'services' ||
            data.user?.vendorType === 'both'
              ? data.user.vendorType
              : undefined
          const normalizedPhoneVerified = normalizeBooleanFlag(
            data?.userProfile?.phoneVerified ?? data?.user?.phone_verified ?? data?.user?.phoneVerified
          )

          setUser({
            uid: data.user.id,
            email: data.user.email,
            displayName: data.user.name,
            role: data.user.role
          })
          const derivedProfile = data.userProfile || {
            uid: data.user.id,
            email: data.user.email,
            displayName: data.user.name,
            role: data.user.role,
            mustChangePassword: !!data.user.mustChangePassword,
            phone: data.user.phone,
            phoneNumber: data.user.phone_number,
            phoneVerified: normalizedPhoneVerified,
            vendorType: data.user.role === 'vendor' ? safeVendorType : undefined,
            walletBalance: typeof data.user.walletBalance === 'number' ? data.user.walletBalance : 0,
            createdAt: new Date(),
            updatedAt: new Date()
          }
          derivedProfile.phoneVerified = normalizedPhoneVerified
          setUserProfile(derivedProfile)
        } else {
          console.log('[AuthContext] No user found in response');
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
    phone?: string,
    vendorType?: "goods" | "services" | "both",
    verificationChannel: "email" = "email",
  ): Promise<{ user: User; userProfile: UserProfile }> => {
    try {
      setLoading(true)
      const result = await signUp(email, password, displayName, role, vendorType, phone, verificationChannel)
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
      <AuthContext.Provider value={{ user: null, userProfile: null, loading: true, refreshProfile, login, register, logout }}>
        {children}
      </AuthContext.Provider>
    )
  }

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, refreshProfile, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
