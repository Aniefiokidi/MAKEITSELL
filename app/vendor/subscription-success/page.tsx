"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, Loader2, AlertCircle } from "lucide-react"
import { createStore, createService } from "@/lib/database-client"
import { uploadToCloudinary } from "@/lib/cloudinary"

export default function VendorSubscriptionSuccess() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reference = searchParams.get('reference')
  const vendorId = searchParams.get('vendor')

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Processing your subscription...')

  useEffect(() => {
    const completeVendorSetup = async () => {
      try {
        // Get stored vendor data from session
        const pendingVendorDataStr = sessionStorage.getItem('pendingVendorData')
        if (!pendingVendorDataStr) {
          throw new Error('Vendor setup data not found')
        }

        const pendingVendorData = JSON.parse(pendingVendorDataStr)
        
        setMessage('Creating your store...')

        // Create store
        await createStore({
          vendorId: pendingVendorData.userId,
          storeName: pendingVendorData.storeName.trim(),
          storeDescription: pendingVendorData.storeDescription.trim(),
          storeImage: pendingVendorData.storeLogoUrl,
          category: pendingVendorData.storeCategory,
          reviewCount: 0,
          isOpen: true,
          deliveryTime: "30-60 min",
          deliveryFee: 500,
          minimumOrder: 2000,
          address: pendingVendorData.storeAddress.trim(),
          phone: pendingVendorData.storePhone.trim(),
          email: pendingVendorData.email,
          // Subscription tracking fields
          subscriptionStatus: 'active',
          subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          isActive: true,
          accountStatus: 'active'
        })

        // Create service if needed
        if (pendingVendorData.vendorType === "services" || pendingVendorData.vendorType === "both") {
          setMessage('Setting up your services...')
          
          await createService({
            providerId: pendingVendorData.userId,
            providerName: pendingVendorData.storeName.trim(),
            title: `${pendingVendorData.storeName.trim()} - Professional Services`,
            description: pendingVendorData.storeDescription.trim(),
            category: pendingVendorData.storeCategory.toLowerCase().replace(/[^a-z0-9]/g, ''),
            subcategory: "general",
            price: 50000,
            pricingType: "hourly",
            duration: 120,
            images: [pendingVendorData.storeLogoUrl],
            location: pendingVendorData.storeAddress.trim(),
            locationType: "both",
            availability: {
              monday: { start: "09:00", end: "17:00", available: true },
              tuesday: { start: "09:00", end: "17:00", available: true },
              wednesday: { start: "09:00", end: "17:00", available: true },
              thursday: { start: "09:00", end: "17:00", available: true },
              friday: { start: "09:00", end: "17:00", available: true },
              saturday: { start: "09:00", end: "15:00", available: true },
              sunday: { start: "10:00", end: "14:00", available: false }
            },
            reviewCount: 0,
            status: "active",
            featured: false,
            tags: ["professional", "service"]
          })
        }

        // Clear session data
        sessionStorage.removeItem('pendingVendorData')

        setStatus('success')
        setMessage('Your vendor account has been successfully created!')

        // Redirect to vendor dashboard after 3 seconds
        setTimeout(() => {
          router.push('/vendor/dashboard')
        }, 3000)

      } catch (error) {
        console.error('Vendor setup completion failed:', error)
        setStatus('error')
        setMessage('Failed to complete vendor setup. Please contact support.')
      }
    }

    if (reference && vendorId) {
      completeVendorSetup()
    } else {
      setStatus('error')
      setMessage('Invalid payment reference. Please try again.')
    }
  }, [reference, vendorId, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            {status === 'loading' && (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-accent" />
                Setting Up Your Store
              </>
            )}
            {status === 'success' && (
              <>
                <CheckCircle className="h-6 w-6 text-green-600" />
                Welcome to Make It Sell!
              </>
            )}
            {status === 'error' && (
              <>
                <AlertCircle className="h-6 w-6 text-red-600" />
                Setup Incomplete
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">{message}</p>
          
          {status === 'success' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="space-y-2">
                <p className="font-semibold text-green-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600 animate-bounce" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L15.09 8.26L22 9L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9L8.91 8.26L12 2Z"/>
                  </svg>
                  Subscription Active!
                </p>
                <p className="text-sm text-green-700">
                  Your monthly subscription of ₦2,500 is now active.
                </p>
                <p className="text-xs text-green-600">
                  You'll be automatically billed monthly. Redirecting to your dashboard...
                </p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700">
                  Payment was successful, but store setup failed.
                </p>
              </div>
              <Button 
                onClick={() => router.push('/vendor/dashboard')}
                variant="outline"
                className="w-full"
              >
                Go to Dashboard
              </Button>
              <Button 
                onClick={() => router.push('/support')}
                variant="default"
                className="w-full"
              >
                Contact Support
              </Button>
            </div>
          )}

          {reference && (
            <p className="text-xs text-muted-foreground">
              Reference: {reference}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}