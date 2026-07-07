'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Copy, Check, Gift, Users, Share2 } from 'lucide-react'

interface ReferralCardProps {
  referralCode: string | null | undefined
  role: 'vendor' | 'customer' | string
}

export function ReferralCard({ referralCode, role }: ReferralCardProps) {
  const [copied, setCopied] = useState(false)

  if (!referralCode) return null

  const referralLink = `https://makeitsell.ng/signup?ref=${referralCode}`

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleWhatsApp = () => {
    const text = encodeURIComponent(
      `Shop and sell on Make It Sell — Nigeria's fastest-growing marketplace. Sign up here: ${referralLink}`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <Card className="border-accent/20 bg-gradient-to-br from-accent/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
          <Gift className="h-5 w-5 text-accent" />
          Refer &amp; Earn
        </CardTitle>
        <CardDescription className="text-sm">
          {role === 'vendor'
            ? 'Earn ₦500 each time someone you refer makes their first purchase or sale on Make It Sell.'
            : 'Earn ₦500 each time someone you refer makes their first purchase or sale on Make It Sell.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">Your referral code:</span>
          <span className="font-mono font-bold text-sm text-accent tracking-widest">{referralCode}</span>
        </div>

        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 border border-border/50">
          <span className="text-xs text-muted-foreground truncate flex-1 font-mono">{referralLink}</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 shrink-0 hover:bg-accent/10 hover:text-accent"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span className="ml-1 text-xs">{copied ? 'Copied!' : 'Copy'}</span>
          </Button>
        </div>

        <Button
          className="w-full bg-[#25D366] hover:bg-[#20b858] text-white gap-2"
          onClick={handleWhatsApp}
        >
          <Share2 className="h-4 w-4" />
          Share on WhatsApp
        </Button>

        <p className="text-xs text-muted-foreground">
          Share your link with friends. When they sign up and complete their first transaction, ₦500 goes straight to your wallet.
        </p>
      </CardContent>
    </Card>
  )
}
