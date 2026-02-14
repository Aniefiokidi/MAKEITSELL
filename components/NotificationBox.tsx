"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react"
import { useNotification, type Notification, type NotificationType } from "@/contexts/NotificationContext"
import { cn } from "@/lib/utils"

const notificationStyles: Record<
  NotificationType,
  {
    bgColor: string
    borderColor: string
    textColor: string
    icon: React.ReactNode
  }
> = {
  success: {
    bgColor: "bg-green-50 dark:bg-green-900/20",
    borderColor: "border-green-500",
    textColor: "text-green-800 dark:text-green-200",
    icon: <CheckCircle className="h-5 w-5 text-green-500" />,
  },
  error: {
    bgColor: "bg-red-50 dark:bg-red-900/20",
    borderColor: "border-red-500",
    textColor: "text-red-800 dark:text-red-200",
    icon: <AlertCircle className="h-5 w-5 text-red-500" />,
  },
  warning: {
    bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
    borderColor: "border-yellow-500",
    textColor: "text-yellow-800 dark:text-yellow-200",
    icon: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
  },
  info: {
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
    borderColor: "border-blue-500",
    textColor: "text-blue-800 dark:text-blue-200",
    icon: <Info className="h-5 w-5 text-blue-500" />,
  },
}

function NotificationItem({ notification }: { notification: Notification }) {
  const router = useRouter()
  const { removeNotification } = useNotification()
  const [isExiting, setIsExiting] = useState(false)
  const styles = notificationStyles[notification.type]

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => {
      removeNotification(notification.id)
    }, 300) // Match animation duration
  }

  useEffect(() => {
    // Add entering animation
    const timer = setTimeout(() => {
      setIsExiting(false)
    }, 10)
    return () => clearTimeout(timer)
  }, [])

  // Only make message notifications clickable
  const isMessageNotification = notification.type === "info" && notification.title === "New Message"
  const handleNotificationClick = () => {
    if (isMessageNotification) {
      router.push("/messages")
      handleClose()
    }
  }
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 rounded-lg border-l-4 shadow-lg backdrop-blur-sm transition-all duration-300 max-w-md w-full",
        styles.bgColor,
        styles.borderColor,
        isExiting
          ? "translate-x-[120%] opacity-0"
          : "translate-x-0 opacity-100 animate-in slide-in-from-right",
        isMessageNotification ? "cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40" : ""
      )}
      onClick={isMessageNotification ? handleNotificationClick : undefined}
      role={isMessageNotification ? "button" : undefined}
      tabIndex={isMessageNotification ? 0 : undefined}
    >
      <div className="flex-shrink-0 mt-0.5">{styles.icon}</div>
      <div className="flex-1 min-w-0">
        {notification.title && (
          <h4 className={cn("text-sm font-semibold mb-1", styles.textColor)}>
            {notification.title}
          </h4>
        )}
        <p className={cn("text-sm", styles.textColor)}>{notification.message}</p>
      </div>
      <button
        onClick={e => { e.stopPropagation(); handleClose(); }}
        className={cn(
          "flex-shrink-0 p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors",
          styles.textColor
        )}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function NotificationBox() {
  const { notifications } = useNotification()

  if (notifications.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none">
      {notifications.map((notification) => (
        <div key={notification.id} className="pointer-events-auto">
          <NotificationItem notification={notification} />
        </div>
      ))}
    </div>
  )
}
