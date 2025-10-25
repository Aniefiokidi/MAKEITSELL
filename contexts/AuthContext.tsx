"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { type User, onAuthStateChanged } from "firebase/auth"
import { getAuthInstance } from "@/lib/firebase"
import { getUserProfile, type UserProfile, signIn, signUp, logOut } from "@/lib/auth"

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

    const auth = getAuthInstance()

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user)

      if (user) {
        // Get user profile from Firestore
        const profile = await getUserProfile(user.uid)
        setUserProfile(profile)
      } else {
        setUserProfile(null)
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const login = async (email: string, password: string) => {
    const user = await signIn(email, password)
    return user
  }

  const register = async (
    email: string,
    password: string,
    displayName: string,
    role: "customer" | "vendor" = "customer",
  ) => {
    const result = await signUp(email, password, displayName, role)
    return result
  }

  const logout = async () => {
    await logOut()
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
