"use client"

import { NotificationProvider } from "@/contexts/NotificationContext"
import { NotificationBox } from "@/components/NotificationBox"
import MessageNotificationWatcher from "@/components/MessageNotificationWatcher"
import AddressRecaptureDialog from "@/components/AddressRecaptureDialog"
import PhoneVerificationModal from "@/components/auth/PhoneVerificationModal"

export default function GlobalClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <NotificationProvider>
      <NotificationBox />
      <MessageNotificationWatcher />
      <AddressRecaptureDialog />
      <PhoneVerificationModal />
      {children}
    </NotificationProvider>
  )
}
