"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, MapPin, Truck } from 'lucide-react'
import { Address, DeliveryEstimate } from '@/lib/mapbox'

interface DeliveryEstimatorProps {
  customerAddress: {
    address: string
    city: string
    state: string
    country: string
  }
  onDeliveryCostUpdate: (cost: number) => void
  disabled?: boolean
}

export default function DeliveryEstimator({ 
  customerAddress, 
  onDeliveryCostUpdate, 
  disabled = false 
}: DeliveryEstimatorProps) {
  const [estimate, setEstimate] = useState<DeliveryEstimate | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const calculateDelivery = async () => {
    if (!customerAddress.address || !customerAddress.city || !customerAddress.state) {
      setError('Please fill in complete address to estimate delivery cost')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/delivery/estimate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerAddress
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to estimate delivery cost')
      }

      const data = await response.json()
      
      if (data.success && data.estimate) {
        setEstimate(data.estimate)
        onDeliveryCostUpdate(data.estimate.cost)
      } else {
        throw new Error('Invalid response from delivery service')
      }
    } catch (err: any) {
      console.error('Delivery estimation error:', err)
      setError(err.message || 'Failed to estimate delivery cost')
      
      // Fallback to a basic cost
      const fallbackCost = 1500
      setEstimate({
        distance: 0,
        cost: fallbackCost,
        duration: 'TBD'
      })
      onDeliveryCostUpdate(fallbackCost)
    } finally {
      setLoading(false)
    }
  }

  // Auto-calculate when address changes
  useEffect(() => {
    if (customerAddress.address && customerAddress.city && customerAddress.state) {
      const timer = setTimeout(() => {
        calculateDelivery()
      }, 1000) // Debounce for 1 second

      return () => clearTimeout(timer)
    }
  }, [customerAddress.address, customerAddress.city, customerAddress.state])

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-NG')
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Truck className="h-5 w-5 text-accent" />
          Delivery Estimation
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-accent mr-2" />
            <span>Calculating delivery cost...</span>
          </div>
        )}

        {estimate && !loading && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-accent/5 rounded-lg border border-accent/20">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-accent" />
                <span className="font-medium">Delivery Cost</span>
              </div>
              <span className="font-bold text-lg text-accent">₦{formatCurrency(estimate.cost)}</span>
            </div>

            {estimate.distance > 0 && (
              <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium">Distance:</span> {estimate.distance} miles
                </div>
                {estimate.duration && (
                  <div>
                    <span className="font-medium">Est. Time:</span> {estimate.duration}
                  </div>
                )}
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              Rate: ₦1,000 per mile • Minimum charge: ₦500
            </div>
          </div>
        )}

        {!estimate && !loading && !error && (
          <div className="text-center py-4">
            <Button 
              onClick={calculateDelivery} 
              disabled={disabled || !customerAddress.address}
              variant="outline"
              className="border-accent/30 text-accent hover:bg-accent/10"
            >
              <MapPin className="h-4 w-4 mr-2" />
              Estimate Delivery Cost
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Fill in your complete address to get accurate delivery cost
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}