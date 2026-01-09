import { NextRequest, NextResponse } from 'next/server'
import { getOrders } from '@/lib/mongodb-operations'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const customerId = searchParams.get('customerId')
    const vendorId = searchParams.get('vendorId')

    if (!customerId && !vendorId) {
      return NextResponse.json(
        { error: 'customerId or vendorId is required' },
        { status: 400 }
      )
    }

    const filters: any = {}
    if (customerId) filters.customerId = customerId
    if (vendorId) filters.vendorId = vendorId

    const orders = await getOrders(filters)
    return NextResponse.json(orders || [])
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}
