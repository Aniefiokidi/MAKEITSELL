'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageCircle, Loader2, CheckCircle2, Copy, Check } from 'lucide-react'

type LinkStatus = {
  status: 'unlinked' | 'pending' | 'linked'
  linkedAt?: string | null
  pendingCode?: string | null
  codeExpiresAt?: string | null
}

export function ConnectWhatsAppCard() {
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [link, setLink] = useState<LinkStatus | null>(null)
  const [botNumber, setBotNumber] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/vendor/whatsapp-link', { credentials: 'include' })
      const data = await res.json()
      if (data?.success) setLink(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  // Countdown for the pending code's remaining validity, and auto-refresh status once
  // it expires so the "generate a code" prompt comes back without a manual reload.
  useEffect(() => {
    if (!link?.codeExpiresAt) {
      setSecondsLeft(null)
      return
    }
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(link.codeExpiresAt!).getTime() - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining === 0) fetchStatus()
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [link?.codeExpiresAt])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/vendor/whatsapp-link', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (data?.success) {
        setBotNumber(data.botNumber || null)
        setLink({ status: 'pending', pendingCode: data.code, codeExpiresAt: data.codeExpiresAt })
      }
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = () => {
    if (!link?.pendingCode) return
    navigator.clipboard.writeText(link.pendingCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-[#25D366]/25 bg-gradient-to-br from-[#25D366]/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
          <MessageCircle className="h-5 w-5 text-[#25D366]" />
          Connect WhatsApp
        </CardTitle>
        <CardDescription className="text-sm">
          Get order alerts and manage your store from WhatsApp — check your balance and mark orders dispatched, right from a chat.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {link?.status === 'linked' ? (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Your WhatsApp is connected.</span>
          </div>
        ) : link?.pendingCode && (secondsLeft ?? 0) > 0 ? (
          <>
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 border border-border/50">
              <span className="flex-1 font-mono font-bold text-lg tracking-widest text-[#25D366]">{link.pendingCode}</span>
              <Button size="sm" variant="ghost" className="h-7 px-2 shrink-0" onClick={handleCopy}>
                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                <span className="ml-1 text-xs">{copied ? 'Copied!' : 'Copy'}</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Message this code to {botNumber || 'our WhatsApp number'} to connect your account.
              Expires in {Math.floor((secondsLeft || 0) / 60)}:{String((secondsLeft || 0) % 60).padStart(2, '0')}.
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Generate a one-time code to link your WhatsApp number.</p>
        )}

        {link?.status !== 'linked' && (
          <Button
            className="w-full bg-[#25D366] hover:bg-[#20b858] text-white gap-2"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating && <Loader2 className="h-4 w-4 animate-spin" />}
            {link?.pendingCode && (secondsLeft ?? 0) > 0 ? 'Generate new code' : 'Get connection code'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
