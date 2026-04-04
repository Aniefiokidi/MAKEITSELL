"use client"

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

const ALLOWED_PATHS = ['/account/complete-setup', '/login', '/api']

export default function ForcePasswordChangeGate() {
  const { user, userProfile } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!user || !userProfile?.mustChangePassword) return

    const allowed = ALLOWED_PATHS.some((path) => pathname.startsWith(path))
    if (!allowed) {
      router.replace('/account/complete-setup')
    }
  }, [user, userProfile?.mustChangePassword, pathname, router])

  return null
}
