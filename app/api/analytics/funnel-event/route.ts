import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { VendorFunnelEvent } from '@/lib/models/VendorFunnelEvent'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const vendorId = String(body?.vendorId || '').trim()
    const eventType = String(body?.eventType || '').trim()

    if (!vendorId || !eventType) {
      return NextResponse.json({ success: false, error: 'vendorId and eventType are required' }, { status: 400 })
    }

    await connectToDatabase()
    await VendorFunnelEvent.create({
      vendorId,
      storeId: body?.storeId ? String(body.storeId) : undefined,
      productId: body?.productId ? String(body.productId) : undefined,
      customerId: body?.customerId ? String(body.customerId) : undefined,
      eventType,
      metadata: body?.metadata || {},
      createdAt: new Date(),
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to track event' }, { status: 500 })
  }
}
