"use client"

import React, { useEffect, useState } from "react"
import { Bell, BellOff, X } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

async function getOrCreateSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null
  const reg = await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  if (existing) return existing
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })
}

export default function NotificationPermission() {
  const { user } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [showBanner, setShowBanner] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!("Notification" in window)) return
    const current = Notification.permission
    setPermission(current)
    // Show banner only if never asked before
    const dismissed = localStorage.getItem("mis:notif-dismissed")
    if (current === "default" && !dismissed) {
      const t = setTimeout(() => setShowBanner(true), 4000)
      return () => clearTimeout(t)
    }
    // If already granted and user just logged in, update subscription with their userId
    if (current === "granted" && user?.uid) {
      getOrCreateSubscription().then((sub) => {
        if (sub) {
          fetch("/api/notifications/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscription: sub.toJSON(), userId: user.uid }),
          }).catch(() => {})
        }
      })
    }
  }, [user?.uid])

  const handleEnable = async () => {
    setLoading(true)
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result === "granted") {
        const sub = await getOrCreateSubscription()
        if (sub) {
          await fetch("/api/notifications/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscription: sub.toJSON(), userId: user?.uid ?? null }),
          })
        }
        setShowBanner(false)
      }
    } catch (err) {
      console.error("[notifications] subscribe error", err)
    } finally {
      setLoading(false)
    }
  }

  const handleDismiss = () => {
    setShowBanner(false)
    localStorage.setItem("mis:notif-dismissed", "1")
  }

  const handleDisable = async () => {
    setLoading(true)
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await fetch("/api/notifications/unsubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          })
          await sub.unsubscribe()
        }
      }
      setPermission("default")
    } catch (err) {
      console.error("[notifications] unsubscribe error", err)
    } finally {
      setLoading(false)
    }
  }

  // Not mounted yet (SSR) or not supported
  if (!mounted || !("Notification" in window) || !("serviceWorker" in navigator)) return null

  // Already granted — show a small quiet bell icon in the corner
  if (permission === "granted") {
    return (
      <button
        onClick={handleDisable}
        disabled={loading}
        className="fixed bottom-20 right-4 z-50 w-10 h-10 rounded-full bg-card shadow-lg border border-border flex items-center justify-center hover:bg-destructive/5 hover:border-destructive/30 transition-colors"
        title="Turn off notifications"
      >
        <Bell className="h-4 w-4 text-accent" />
      </button>
    )
  }

  // Blocked — nothing we can do from JS
  if (permission === "denied") return null

  // Banner prompt
  if (!showBanner) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto">
      <div className="bg-card rounded-2xl shadow-2xl border border-border p-4">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
            <Bell className="h-5 w-5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Stay in the loop</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Get notified about your orders, delivery updates, and deals — even when the app is closed.
            </p>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleEnable}
            disabled={loading}
            className="flex-1 bg-accent text-white text-sm font-semibold py-2 rounded-xl hover:bg-accent/90 transition-colors disabled:opacity-60"
          >
            {loading ? "Enabling…" : "Enable notifications"}
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 text-sm text-muted-foreground hover:text-foreground"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  )
}
