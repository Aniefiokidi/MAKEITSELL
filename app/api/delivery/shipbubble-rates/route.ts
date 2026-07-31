import { NextRequest, NextResponse } from 'next/server'
import { getDeliveryQuotesForCart } from '@/lib/delivery-quotes'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const customerAddress = body?.customerAddress || {}
    const items: any[] = Array.isArray(body?.items) ? body.items : []

    const result = await getDeliveryQuotesForCart({
      customerAddress: {
        name: String(customerAddress?.name || 'Customer'),
        email: String(customerAddress?.email || ''),
        phone: String(customerAddress?.phone || ''),
        address: String(customerAddress?.address || ''),
        city: String(customerAddress?.city || ''),
        state: String(customerAddress?.state || ''),
      },
      items: items.map((item) => ({
        vendorId: String(item?.vendorId || ''),
        productId: String(item?.productId || ''),
        quantity: Number(item?.quantity || 1),
        price: Number(item?.price || 0),
      })),
    })

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status })
    }

    return NextResponse.json({ success: true, vendors: result.vendors })
  } catch (error: any) {
    console.error('[shipbubble-rates] Failed:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch delivery rates' }, { status: 500 })
  }
}
