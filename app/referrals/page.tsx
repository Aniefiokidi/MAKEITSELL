"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/contexts/AuthContext"
import Header from "@/components/Header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ReferralCard } from "@/components/shared/ReferralCard"
import { MousePointerClick, UserPlus, Wallet, Store } from "lucide-react"

type ReferralRow = {
  id: string
  name: string
  role: string
  joinedAt: string
  credited: boolean
}

type ReferralStats = {
  referralCode: string | null
  clickCount: number
  signupCount: number
  paidCount: number
  totalEarnings: number
  storeVisitCount?: number
  referrals: ReferralRow[]
}

export default function ReferralsPage() {
  const { user, userProfile } = useAuth()
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    fetch('/api/referral/stats', { credentials: 'include' })
      .then((res) => res.json())
      .then((json) => {
        if (json?.success) setStats(json)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

  const formatCurrency = (n: number) => `₦${Number(n || 0).toLocaleString('en-NG')}`

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="mb-8">
            <nav className="text-sm text-muted-foreground mb-4">
              <Link href="/" className="hover:text-accent">Home</Link>
              <span className="mx-2">/</span>
              <span>Referral Dashboard</span>
            </nav>
            <h1 className="text-3xl font-bold mb-2">Referral Dashboard</h1>
            <p className="text-muted-foreground">Track your referral link's clicks, signups, and earnings in one place.</p>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-24">
              <span className="animate-spin rounded-full h-10 w-10 border-[3px] border-accent border-t-transparent" />
            </div>
          ) : !stats ? (
            <p className="text-center text-muted-foreground py-16">Sign in to see your referral stats.</p>
          ) : (
            <>
              <div className={`grid grid-cols-1 sm:grid-cols-2 ${stats.storeVisitCount !== undefined ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 mb-8`}>
                <Card>
                  <CardContent className="p-5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <MousePointerClick className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.clickCount}</p>
                      <p className="text-xs text-muted-foreground">Link clicks</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                      <UserPlus className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.signupCount}</p>
                      <p className="text-xs text-muted-foreground">Signups</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <Wallet className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{formatCurrency(stats.totalEarnings)}</p>
                      <p className="text-xs text-muted-foreground">Total earned ({stats.paidCount} paid)</p>
                    </div>
                  </CardContent>
                </Card>
                {stats.storeVisitCount !== undefined && (
                  <Card>
                    <CardContent className="p-5 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                        <Store className="h-5 w-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{stats.storeVisitCount}</p>
                        <p className="text-xs text-muted-foreground">Store page visits</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>People You've Referred</CardTitle>
                      <CardDescription>
                        {stats.signupCount === 0
                          ? "Nobody has signed up with your link yet."
                          : `${stats.signupCount} ${stats.signupCount === 1 ? 'person has' : 'people have'} signed up using your link.`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {stats.referrals.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-6 text-center">
                          Share your link below to start earning ₦500 per referral.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {stats.referrals.map((r) => (
                            <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                              <div>
                                <p className="text-sm font-medium">{r.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {r.role === 'vendor' ? 'Vendor' : 'Buyer'} · Joined {new Date(r.joinedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                              </div>
                              <Badge variant={r.credited ? 'default' : 'secondary'} className={r.credited ? 'bg-green-600' : ''}>
                                {r.credited ? '₦500 earned' : 'Pending first order'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <ReferralCard referralCode={stats.referralCode} role={(userProfile as any)?.role || 'customer'} hideDashboardLink />
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
