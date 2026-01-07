"use client"

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, ArrowRight, Store, CreditCard } from 'lucide-react'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { useAuth } from '@/contexts/AuthContext'

function SignupSuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { login } = useAuth()
  const isVendor = searchParams.get('vendor') === 'true'
  const reference = searchParams.get('reference')
  const loginToken = searchParams.get('login_token')
  const [countdown, setCountdown] = useState(5)
  const [loggingIn, setLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loginAttempted, setLoginAttempted] = useState(false)

  useEffect(() => {
    // Auto-login if loginToken is present - but only try once
    if (loginToken && isVendor && !loginAttempted) {
      setLoginAttempted(true)
      setLoggingIn(true)
      
      const autoLogin = async () => {
        try {
          const response = await fetch('/api/auth/verify-signup-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ loginToken })
          })

          if (response.ok) {
            const data = await response.json()
            console.log('Token verified, user data:', data.user)
            
            // Store session data in localStorage
            if (data.user) {
              localStorage.setItem('user', JSON.stringify({
                uid: data.user.id,
                email: data.user.email,
                displayName: data.user.name
              }))
              
              localStorage.setItem('userProfile', JSON.stringify({
                uid: data.user.id,
                email: data.user.email,
                displayName: data.user.name,
                role: data.user.role
              }))
              
              setIsLoggedIn(true)
              console.log('Auto-login successful - session established')
            }
          } else {
            const errorData = await response.json()
            console.log('Token verification failed:', errorData.error)
            setLoginError(null) // Don't show error, just skip auto-login
          }
        } catch (error) {
          console.log('Auto-login error - continuing without auto-login')
          setLoginError(null) // Don't show error, just skip auto-login
        } finally {
          setLoggingIn(false)
        }
      }
      autoLogin()
    }
  }, []) // Empty dependency array - only run once on mount

  useEffect(() => {
    if (loggingIn) return // Don't start countdown while logging in

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          // Only redirect to dashboard if successfully logged in
          if (isLoggedIn) {
            if (isVendor) {
              window.location.href = '/vendor/dashboard'
            } else {
              window.location.href = '/dashboard'
            }
          } else {
            // If auto-login failed, redirect to login page
            window.location.href = '/login?message=signup_complete'
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isVendor, loggingIn, isLoggedIn])

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {isVendor ? (
                <span className="flex items-center gap-2">
                  <svg className="w-6 h-6 text-green-500 animate-bounce" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L15.09 8.26L22 9L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9L8.91 8.26L12 2Z"/>
                  </svg>
                  Welcome to Make It Sell!
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="w-6 h-6 text-green-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Account Created Successfully!
                </span>
              )}
            </h1>
            
            <p className="text-lg text-gray-600 mb-6">
              {isVendor 
                ? 'Your vendor account has been created and your subscription is active!'
                : 'Your account has been created successfully. Welcome to Make It Sell!'
              }
            </p>

            {loggingIn && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-blue-800 text-sm flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Logging you in...
                </p>
              </div>
            )}

            {loginError && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-yellow-800 text-sm">{loginError}</p>
                <Link href="/login" className="text-yellow-900 underline text-sm mt-1 inline-block">
                  Click here to log in manually
                </Link>
              </div>
            )}

            {isLoggedIn && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <p className="text-green-800 text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Successfully logged in!
                </p>
              </div>
            )}
          </div>

          {isVendor && (
            <div className="space-y-6">
              <Card className="border-green-200 bg-green-50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-green-800">
                    <CreditCard className="w-5 h-5" />
                    Payment Confirmed
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-green-700">Subscription Amount:</span>
                    <span className="font-semibold text-green-800">₦2,500</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-green-700">Billing Period:</span>
                    <span className="font-semibold text-green-800">Monthly</span>
                  </div>
                  {reference && (
                    <div className="flex justify-between items-center">
                      <span className="text-green-700">Reference:</span>
                      <span className="font-mono text-sm text-green-800">{reference}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Store className="w-5 h-5" />
                    What's Next?
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 text-sm font-semibold">1</span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Set up your store</h4>
                        <p className="text-gray-600 text-sm">Complete your store profile and add your first products or services</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 text-sm font-semibold">2</span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Start selling</h4>
                        <p className="text-gray-600 text-sm">Your store is now visible to customers on Make It Sell</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 text-sm font-semibold">3</span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Manage orders</h4>
                        <p className="text-gray-600 text-sm">Use your dashboard to track orders and communicate with customers</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="text-center mt-8 space-y-4">
            <div className="bg-accent/10 p-4 rounded-lg">
              <p className="text-accent mb-2 font-semibold">
                Redirecting you to your {isVendor ? 'vendor dashboard' : 'account'} in {countdown} seconds...
              </p>
              <div className="w-full bg-accent/20 rounded-full h-2">
                <div 
                  className="bg-accent h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${((5 - countdown) / 5) * 100}%` }}
                ></div>
              </div>
            </div>
            
            <Button asChild size="lg" className="min-w-48">
              <Link href={isVendor ? '/vendor/dashboard' : '/dashboard'}>
                Go to {isVendor ? 'Vendor Dashboard' : 'Dashboard'}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
            
            <div className="text-sm text-muted-foreground">
              <p>
                Need help getting started?{' '}
                <Link href="/support" className="text-accent hover:underline">
                  Contact our support team
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default function SignupSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    }>
      <SignupSuccessContent />
    </Suspense>
  )
}