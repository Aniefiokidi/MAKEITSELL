"use client"

import { useEffect, useRef } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useNotification } from "@/contexts/NotificationContext"

export default function MessageNotificationWatcher() {
  const { user, userProfile } = useAuth()
  const { info } = useNotification()
  const lastUnreadCount = useRef(0)
  const firstLoad = useRef(true)

  useEffect(() => {
    if (!user || !userProfile) return
    let interval: NodeJS.Timeout | null = null

    const checkMessages = async () => {
      const role = userProfile.role === "vendor" ? "provider" : "customer"
      const res = await fetch(`/api/messages?userId=${user.uid}&role=${role}`)
      const result = await res.json()
      if (!result.conversations) return
      const unread = result.conversations.reduce((sum: number, conv: any) => {
        const count = role === "provider" ? conv.providerUnreadCount : conv.customerUnreadCount
        return sum + (count || 0)
      }, 0)
      if (unread > 0 && (firstLoad.current || unread > lastUnreadCount.current)) {
        info(
          unread === 1
            ? "You have a new message."
            : `You have ${unread} new messages.`,
          "New Message"
        )
      }
      lastUnreadCount.current = unread
      firstLoad.current = false
    }

    checkMessages()
    interval = setInterval(checkMessages, 30000)
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [user, userProfile, info])

  return null
}
