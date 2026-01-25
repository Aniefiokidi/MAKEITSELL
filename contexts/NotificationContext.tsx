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
  success: (message: string, title?: string, duration?: number) => void
  error: (message: string, title?: string, duration?: number) => void
  warning: (message: string, title?: string, duration?: number) => void
  info: (message: string, title?: string, duration?: number) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = useCallback((notification: Omit<Notification, "id">) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newNotification: Notification = {
      id,
      ...notification,
      duration: notification.duration || 5000, // Default 5 seconds
    }

    setNotifications((prev) => [...prev, newNotification])

    // Auto remove after duration
    if (newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id)
      }, newNotification.duration)
    }
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id))
  }, [])

  const success = useCallback(
    (message: string, title?: string, duration?: number) => {
      addNotification({ type: "success", message, title, duration })
    },
    [addNotification]
  )

  const error = useCallback(
    (message: string, title?: string, duration?: number) => {
      addNotification({ type: "error", message, title, duration })
    },
    [addNotification]
  )

  const warning = useCallback(
    (message: string, title?: string, duration?: number) => {
      addNotification({ type: "warning", message, title, duration })
    },
    [addNotification]
  )

  const info = useCallback(
    (message: string, title?: string, duration?: number) => {
      addNotification({ type: "info", message, title, duration })
    },
    [addNotification]
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
