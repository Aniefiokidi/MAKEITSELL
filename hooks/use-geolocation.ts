"use client"

import { useState, useCallback } from "react"

export interface GeoState {
  lat: number | null
  lng: number | null
  loading: boolean
  error: string | null
  granted: boolean   // true once we have coordinates
}

const CACHE_KEY = "mis:user:location:v1"
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

function readCache(): { lat: number; lng: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { lat, lng, ts } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL) return null
    return { lat, lng }
  } catch {
    return null
  }
}

function writeCache(lat: number, lng: number) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ lat, lng, ts: Date.now() }))
  } catch { /* ignore */ }
}

export function useGeolocation() {
  const [state, setState] = useState<GeoState>(() => {
    // Hydrate from cache on first render (client only)
    if (typeof window === "undefined") return { lat: null, lng: null, loading: false, error: null, granted: false }
    const cached = readCache()
    if (cached) return { lat: cached.lat, lng: cached.lng, loading: false, error: null, granted: true }
    return { lat: null, lng: null, loading: false, error: null, granted: false }
  })

  const request = useCallback(() => {
    if (!navigator?.geolocation) {
      setState((s) => ({ ...s, error: "Location not supported on this device", loading: false }))
      return
    }
    setState((s) => ({ ...s, loading: true, error: null }))
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        writeCache(lat, lng)
        setState({ lat, lng, loading: false, error: null, granted: true })
      },
      (err) => {
        const msg =
          err.code === 1
            ? "Location permission denied. Enable it in your browser settings."
            : "Could not get your location. Please try again."
        setState((s) => ({ ...s, loading: false, error: msg }))
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: CACHE_TTL }
    )
  }, [])

  const clear = useCallback(() => {
    try { localStorage.removeItem(CACHE_KEY) } catch { /* ignore */ }
    setState({ lat: null, lng: null, loading: false, error: null, granted: false })
  }, [])

  return { ...state, request, clear }
}
