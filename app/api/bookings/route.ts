import { NextRequest, NextResponse } from 'next/server'
import { getBookings } from '@/lib/mongodb-operations'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'

// This route had no auth check at all — any caller could pass an arbitrary customerId
// or vendorId and read back full booking documents (customer name/email/phone, address,
// price, notes) for that id. The real UI uses /api/database/bookings (already
// session-scoped); this legacy route is left in place but locked down the same way
// rather than removed, in case something still depends on the path.
export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const requestedCustomerId = searchParams.get('customerId')
    const requestedVendorId = searchParams.get('vendorId')

    if (!requestedCustomerId && !requestedVendorId) {
      return NextResponse.json(
        { error: 'customerId or vendorId is required' },
        { status: 400 }
      )
    }

    const isAdmin = String(sessionUser.role || '').toLowerCase() === 'admin'
    if (!isAdmin) {
      if (requestedCustomerId && requestedCustomerId !== sessionUser.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (requestedVendorId && requestedVendorId !== sessionUser.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const filters: any = {}
    if (requestedCustomerId) filters.customerId = requestedCustomerId
    if (requestedVendorId) filters.vendorId = requestedVendorId

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
