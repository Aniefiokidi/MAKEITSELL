'use client'

import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Loader2, Smartphone } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

function sanitizePhonePrefill(value: string): string {
  const normalized = String(value || '').trim()
  if (!normalized) return ''
  if (normalized.includes('@')) return ''
  return normalized
}

export default function PhoneVerificationModal() {
  const { user, userProfile, refreshProfile } = useAuth()
  const [open, setOpen] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [enabledForUser, setEnabledForUser] = useState(false)
  const [loadingEligibility, setLoadingEligibility] = useState(false)

  const shouldRequireVerification = useMemo(() => {
    if (!enabledForUser) return false
    return !userProfile?.phoneVerified
  }, [enabledForUser, userProfile?.phoneVerified])

  useEffect(() => {
    const loadSettings = async () => {
      if (!user?.email) {
        setEnabledForUser(false)
        return
      }

      setLoadingEligibility(true)
      try {
        const response = await fetch('/api/auth/phone/settings', {
          method: 'GET',
          credentials: 'include',
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok || !result?.success) {
          setEnabledForUser(false)
          return
        }
        setEnabledForUser(!!result.enabledForCurrentUser)
      } catch {
        setEnabledForUser(false)
      } finally {
        setLoadingEligibility(false)
      }
    }

    loadSettings()
  }, [user?.email])

  useEffect(() => {
    setOpen(shouldRequireVerification)
  }, [shouldRequireVerification])

  useEffect(() => {
    const initialPhone = userProfile?.phoneNumber || userProfile?.phone || ''
    setPhoneNumber(sanitizePhonePrefill(initialPhone))
  }, [userProfile?.phoneNumber, userProfile?.phone, open])

  useEffect(() => {
    if (countdown <= 0) return

    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => clearInterval(timer)
  }, [countdown])

  const sendOtp = async () => {
    setError('')
    setSuccess('')
    setSending(true)

    try {
      const response = await fetch('/api/auth/phone/send-otp', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      })

      const result = await response.json()
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Failed to send OTP')
      }

      setOtpSent(true)
      setCountdown(Number(result?.resendInSeconds || 60))
      setSuccess('OTP sent successfully. Check your SMS inbox.')
    } catch (err: any) {
      setError(err?.message || 'Failed to send OTP')
    } finally {
      setSending(false)
    }
  }

  const verifyOtp = async () => {
    setError('')
    setSuccess('')

    if (otp.length !== 6) {
      setError('Enter the full 6-digit OTP code.')
      return
    }

    setVerifying(true)

    try {
      const response = await fetch('/api/auth/phone/verify-otp', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp, phoneNumber }),
      })

      const result = await response.json()
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Failed to verify OTP')
      }

      setSuccess('Phone number verified successfully')
      await refreshProfile()
      setTimeout(() => {
        setOpen(false)
      }, 900)
    } catch (err: any) {
      setError(err?.message || 'Failed to verify OTP')
    } finally {
      setVerifying(false)
    }
  }

  if (loadingEligibility || !shouldRequireVerification) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => setOpen(nextOpen ? true : shouldRequireVerification)}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-accent" />
            Verify Your Phone Number
          </DialogTitle>
          <DialogDescription>
            Secure your account by verifying your phone number
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone-number">Phone Number</Label>
            <Input
              id="phone-number"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="e.g. 08012345678"
              disabled={sending || verifying}
              className="border-accent/40 focus-visible:ring-accent/30"
            />
          </div>

          {!otpSent ? (
            <Button
              onClick={sendOtp}
              disabled={sending || !phoneNumber.trim()}
              className="w-full border border-accent/40 bg-white text-accent hover:bg-accent hover:text-white transition-all"
            >
              {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {sending ? 'Sending OTP...' : 'Send OTP'}
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Enter OTP</Label>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} className="border-accent/40" />
                      <InputOTPSlot index={1} className="border-accent/40" />
                      <InputOTPSlot index={2} className="border-accent/40" />
                      <InputOTPSlot index={3} className="border-accent/40" />
                      <InputOTPSlot index={4} className="border-accent/40" />
                      <InputOTPSlot index={5} className="border-accent/40" />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>

              <Button
                onClick={verifyOtp}
                disabled={verifying || otp.length !== 6}
                className="w-full border border-accent/40 bg-white text-accent hover:bg-accent hover:text-white transition-all"
              >
                {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {verifying ? 'Verifying OTP...' : 'Verify OTP'}
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                {countdown > 0 ? (
                  <span>Resend OTP in {countdown}s</span>
                ) : (
                  <Button variant="link" className="h-auto p-0 text-accent hover:text-accent/80" onClick={sendOtp} disabled={sending}>
                    Resend OTP
                  </Button>
                )}
              </div>
            </div>
          )}

          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertDescription className="text-red-700">{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50">
              <AlertDescription className="text-green-700">{success}</AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
