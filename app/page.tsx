"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import Header from "@/components/Header"
import HeroSection from "@/components/HeroSection"
import CategorySection from "@/components/CategorySection"
import FeaturedServices from "@/components/FeaturedServices"
import Footer from "@/components/Footer"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2 } from "lucide-react"

export default function HomePage() {
  const searchParams = useSearchParams()
  const [showDeletedMessage, setShowDeletedMessage] = useState(false)

  useEffect(() => {
    if (searchParams.get('account_deleted') === 'true') {
      setShowDeletedMessage(true)
      // Hide message after 5 seconds
      setTimeout(() => setShowDeletedMessage(false), 5000)
    }
  }, [searchParams])

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {showDeletedMessage && (
          <div className="container mx-auto px-4 pt-4">
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Your account has been successfully deleted. Thank you for using Make It Sell!
              </AlertDescription>
            </Alert>
          </div>
        )}
        <HeroSection />
        <CategorySection />
        
        
        <FeaturedServices />
      </main>
      <Footer />
    </div>
  )
}
