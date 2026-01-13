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
  const [showIntro, setShowIntro] = useState(true)
  const [fadeOutIntro, setFadeOutIntro] = useState(false)

  useEffect(() => {
    if (searchParams.get('account_deleted') === 'true') {
      setShowDeletedMessage(true)
      // Hide message after 5 seconds
      setTimeout(() => setShowDeletedMessage(false), 5000)
    }
  }, [searchParams])

  // Fallback timeout in case the video doesn't fire onEnded (mobile/browsers)
  useEffect(() => {
    if (!showIntro) return
    const timer = setTimeout(() => {
      setFadeOutIntro(true)
      setTimeout(() => setShowIntro(false), 700)
    }, 6000)
    return () => clearTimeout(timer)
  }, [showIntro])

  const startFadeOutIntro = () => {
    if (fadeOutIntro) return
    setFadeOutIntro(true)
    setTimeout(() => setShowIntro(false), 900)
  }

  const handleIntroEnd = () => startFadeOutIntro()
  const handleSkip = () => startFadeOutIntro()

  return (
    <div className="min-h-screen flex flex-col relative">
      {showIntro && (
        <div
          className={`fixed inset-0 bg-black flex items-center justify-center overflow-hidden transition-opacity duration-700 ${fadeOutIntro ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        >
          <video
            className="absolute inset-0 w-full h-full object-cover"
            src="/images/VID.MOV"
            autoPlay
            muted
            playsInline
            onEnded={handleIntroEnd}
          />
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute bottom-8 inset-x-0 flex justify-center">
            <button
              onClick={handleSkip}
              className="px-4 py-2 text-sm font-semibold text-white bg-black/60 border border-white/30 rounded-full backdrop-blur-md hover:bg-white/10 transition"
            >
              Skip intro
            </button>
          </div>
        </div>
      )}

      <div className={`min-h-screen flex flex-col transition-opacity duration-700 ${showIntro ? 'opacity-0' : 'opacity-100'}`}>
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
    </div>
  )
}
