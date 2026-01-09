import { NextRequest, NextResponse } from 'next/server'
import { getBookings } from '@/lib/mongodb-operations'

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

    const bookings = await getBookings(filters)
    return NextResponse.json(bookings || [])
  } catch (error) {
    console.error('Error fetching bookings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bookings' },
      { status: 500 }
    )
  }
}
