"use client"

import { NotificationProvider } from "@/contexts/NotificationContext"
import { NotificationBox } from "@/components/NotificationBox"
import MessageNotificationWatcher from "@/components/MessageNotificationWatcher"

export default function GlobalClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <NotificationProvider>
      <NotificationBox />
      <MessageNotificationWatcher />
      {children}
    </NotificationProvider>
  )
}
