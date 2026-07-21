import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Store } from '@/lib/models/Store'
import { estimateShippingFee } from '@/lib/aco-logistics-rates'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { customerAddress, items } = body

    if (!customerAddress || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Customer address is required' }, { status: 400 })
    }

    await connectToDatabase()

    const vendorIds = Array.from(new Set(items.map((item: any) => String(item?.vendorId || '')).filter(Boolean)))
    const stores = vendorIds.length > 0 ? await Store.find({ vendorId: { $in: vendorIds } }).lean() : []

    const storeByVendorId = new Map<string, any>()
    for (const store of stores as any[]) {
      const vid = String(store?.vendorId || '')
      if (!vid || storeByVendorId.has(vid)) continue
      storeByVendorId.set(vid, store)
    }

    const dropoffAddress = [
      customerAddress?.address,
      customerAddress?.city,
      customerAddress?.state,
      customerAddress?.country || 'Nigeria',
    ].filter(Boolean).join(', ')

    let totalCost = 0
    let hasTbd = false
    const breakdown: Array<{ vendorId: string; storeName: string; cost: number | null; source: 'matrix' | 'tbd' }> = []

    // Same min/max business-day windows shown on the order-tracking timeline (1-2 days
    // same-state, 3-5 interstate) — aggregated across every vendor in the cart so the
    // checkout day-picker covers the earliest-possible to latest-possible arrival.
    let aggMinDays: number | null = null
    let aggMaxDays: number | null = null
    const customerState = String(customerAddress?.state || '').trim().toLowerCase()

    for (const vendorId of vendorIds) {
      const store = storeByVendorId.get(vendorId)
      const vendorState = String(store?.state || '').trim().toLowerCase()
      const isSameState = Boolean(vendorState && customerState && vendorState === customerState)
      const vendorMinDays = isSameState ? 1 : 3
      const vendorMaxDays = isSameState ? 2 : 5
      aggMinDays = aggMinDays === null ? vendorMinDays : Math.min(aggMinDays, vendorMinDays)
      aggMaxDays = aggMaxDays === null ? vendorMaxDays : Math.max(aggMaxDays, vendorMaxDays)

      const pickupAddressText = String(store?.address || '')

      const matrixCost = estimateShippingFee({
        pickupAddress: pickupAddressText,
        dropoffAddress,
        pickupCity: String(store?.city || ''),
        pickupState: String(store?.state || ''),
        dropoffCity: String(customerAddress?.city || ''),
        dropoffState: String(customerAddress?.state || ''),
      })

      if (typeof matrixCost === 'number') {
        totalCost += matrixCost
        breakdown.push({
          vendorId,
          storeName: String(store?.storeName || 'Store'),
          cost: matrixCost,
          source: 'matrix',
        })
        continue
      }

      hasTbd = true
      breakdown.push({
        vendorId,
        storeName: String(store?.storeName || 'Store'),
        cost: null,
        source: 'tbd',
      })
    }

    return NextResponse.json({
      success: true,
      estimate: {
        cost: totalCost,
        hasTbd,
        source: hasTbd ? 'tbd' : 'matrix',
        breakdown,
        minDays: aggMinDays ?? 1,
        maxDays: aggMaxDays ?? 5,
      },
    })
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