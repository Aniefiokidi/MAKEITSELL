"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import Header from "@/components/Header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle } from "lucide-react"

export default function BookingConfirmationPage() {
  const searchParams = useSearchParams()
  const bookingId = searchParams.get("bookingId")

  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-12 min-h-screen">
        <div className="max-w-lg mx-auto text-center space-y-6">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
          <div>
            <h1 className="text-2xl font-bold mb-2">Booking confirmed</h1>
            <p className="text-muted-foreground">
              Your deposit and booking fee have been paid. The provider has been notified and will
              be in touch to arrange the rest — the remaining balance is settled directly with them.
            </p>
          </div>
          <Card>
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground">
                Confirmation details have been sent to your email{bookingId ? ` (Booking #${bookingId.slice(0, 8).toUpperCase()})` : ""}.
              </p>
            </CardContent>
          </Card>
          <Button asChild className="w-full">
            <Link href="/appointments">View my appointments</Link>
          </Button>
        </div>
      </main>
    </>
  )
}
