import { NextRequest, NextResponse } from 'next/server'
import { mapboxService, Address } from '@/lib/mapbox'
import { connectToDatabase } from '@/lib/mongodb'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { customerAddress, vendorId, items } = body

    if (!customerAddress) {
      return NextResponse.json({ error: 'Customer address is required' }, { status: 400 })
    }

    // Connect to database to get vendor information
    await connectToDatabase()
    
    // For now, we'll use a default vendor address (can be enhanced to get from vendor profile)
    // This should ideally fetch the vendor's actual address from their store/profile
    const defaultVendorAddress: Address = {
      address: 'Victoria Island',
      city: 'Lagos',
      state: 'Lagos',
      country: 'Nigeria'
    }

    // Estimate delivery cost using Mapbox
    const deliveryEstimate = await mapboxService.estimateDelivery(
      defaultVendorAddress,
      customerAddress
    )

    if (deliveryEstimate) {
      return NextResponse.json({
        success: true,
        estimate: deliveryEstimate
      })
    } else {
      // Fallback to simple city/state-based pricing
      const fallbackCost = mapboxService.getFallbackDeliveryCost(
        customerAddress.city,
        customerAddress.state
      )

      return NextResponse.json({
        success: true,
        estimate: {
          distance: 0,
          cost: fallbackCost,
          duration: 'TBD',
          fallback: true
        }
      })
    }
  } catch (error) {
    console.error('Delivery estimation error:', error)
    return NextResponse.json({ 
      error: 'Failed to estimate delivery cost',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Delivery estimation endpoint. Use POST with customer address.' })
}