"use client"

import { useEffect, useState } from "react"
import VendorLayout from "@/components/vendor/VendorLayout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { Users, MessageCircle, Mail, ShoppingBag } from "lucide-react"

type RepeatCustomer = {
  customerId: string
  name: string
  email: string
  phone: string
  orderCount: number
  totalSpent: number
  lastOrderAt: string | null
}

export default function VendorRepeatCustomersPage() {
  const { user } = useAuth()
  const [customers, setCustomers] = useState<RepeatCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const load = async () => {
      if (!user) return
      setLoading(true)
      setError("")
      try {
        if (!user?.uid) throw new Error("No vendor ID")
        const res = await fetch(`/api/vendor/customers/repeat?vendorId=${encodeURIComponent(user.uid)}`)
        const data = await res.json()
        if (data.success) {
          setCustomers(data.customers || [])
        } else {
          setError(data.error || "Failed to load repeat customers")
        }
      } catch (err) {
        setError("Failed to load repeat customers")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  const formatNaira = (amount: number) => `₦${Number(amount || 0).toLocaleString('en-NG')}`

  const whatsappLink = (phone: string, name: string) => {
    const digits = phone.replace(/[^\d+]/g, '')
    const text = encodeURIComponent(`Hi ${name.split(' ')[0] || 'there'}, thanks for shopping with us! We've got some new items you might like.`)
    return `https://wa.me/${digits.replace(/^\+/, '')}?text=${text}`
  }

  if (loading) {
    return (
      <VendorLayout>
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </VendorLayout>
    )
  }

  if (error) {
    return (
      <VendorLayout>
        <div className="flex items-center justify-center py-16 text-red-600">{error}</div>
      </VendorLayout>
    )
  }

  return (
    <VendorLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-accent" />
            Repeat Customers
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Customers who've bought from you more than once — your most loyal buyers, worth reaching out to directly.
          </p>
        </div>

        {customers.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <ShoppingBag className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-semibold mb-1">No repeat customers yet</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Once a customer orders from you twice, they'll show up here with their order history and a quick way to reach out.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{customers.length} repeat {customers.length === 1 ? 'customer' : 'customers'}</CardTitle>
              <CardDescription>Sorted by total spend</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {customers.map((c) => (
                <div key={c.customerId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-border bg-muted/20">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{c.name}</p>
                      <Badge variant="secondary">{c.orderCount} orders</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {c.email || 'No email on file'}{c.phone ? ` · ${c.phone}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Last order: {c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-bold text-accent">{formatNaira(c.totalSpent)}</p>
                      <p className="text-[11px] text-muted-foreground">total spent</p>
                    </div>
                    <div className="flex gap-2">
                      {c.phone && (
                        <Button size="sm" variant="outline" className="bg-[#25D366]/10 border-[#25D366]/30 text-[#128C7E] hover:bg-[#25D366]/20" asChild>
                          <a href={whatsappLink(c.phone, c.name)} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp
                          </a>
                        </Button>
                      )}
                      {c.email && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={`mailto:${c.email}`}>
                            <Mail className="h-3.5 w-3.5 mr-1" /> Email
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </VendorLayout>
  )
}
