"use client"

import React, { createContext, useContext, useState, useCallback } from "react"

export type NotificationType = "success" | "error" | "warning" | "info"

export interface Notification {
  id: string
  type: NotificationType
  title?: string
  message: string
  duration?: number
}

interface NotificationContextType {
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, "id">) => void
  removeNotification: (id: string) => void
  success: (message: unknown, title?: string, duration?: number) => void
  error: (message: unknown, title?: string, duration?: number) => void
  warning: (message: unknown, title?: string, duration?: number) => void
  info: (message: unknown, title?: string, duration?: number) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const normalizeMessage = useCallback((value: unknown): string => {
    if (typeof value === "string") return value
    if (typeof value === "number" || typeof value === "boolean") return String(value)
    if (!value) return "Something went wrong"

    if (Array.isArray(value)) {
      const parts = value
        .map((item) => normalizeMessage(item))
        .filter(Boolean)
      return parts.join("; ") || "Something went wrong"
    }

    if (typeof value === "object") {
      const maybeMessage = (value as any).message || (value as any).msg || (value as any).error || (value as any).detail
      if (typeof maybeMessage === "string" && maybeMessage.trim()) {
        return maybeMessage
      }

      try {
        return JSON.stringify(value)
      } catch {
        return "Something went wrong"
      }
    }

    return "Something went wrong"
  }, [])

  const addNotification = useCallback((notification: Omit<Notification, "id">) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const duration = notification.duration ?? 5000
    const newNotification: Notification = {
      id,
      ...notification,
      message: normalizeMessage(notification.message),
      duration, // Default 5 seconds
    }

    setNotifications((prev) => [...prev, newNotification])

    // Auto remove after duration
    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id)
      }, duration)
    }
  }, [normalizeMessage])

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id))
  }, [])

  const success = useCallback(
    (message: unknown, title?: string, duration?: number) => {
      addNotification({ type: "success", message: normalizeMessage(message), title, duration })
    },
    [addNotification, normalizeMessage]
  )

  const error = useCallback(
    (message: unknown, title?: string, duration?: number) => {
      addNotification({ type: "error", message: normalizeMessage(message), title, duration })
    },
    [addNotification, normalizeMessage]
  )

  const warning = useCallback(
    (message: unknown, title?: string, duration?: number) => {
      addNotification({ type: "warning", message: normalizeMessage(message), title, duration })
    },
    [addNotification, normalizeMessage]
  )

  const info = useCallback(
    (message: unknown, title?: string, duration?: number) => {
      addNotification({ type: "info", message: normalizeMessage(message), title, duration })
    },
    [addNotification, normalizeMessage]
  )

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        success,
        error,
        warning,
        info,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotification() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error("useNotification must be used within a NotificationProvider")
  }
  return context
}
