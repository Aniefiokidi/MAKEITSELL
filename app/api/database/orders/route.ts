import { NextRequest, NextResponse } from "next/server"
import { getOrdersByVendor, getOrders } from "@/lib/mongodb-operations"
import { requireRoles } from "@/lib/server-route-auth"

export async function GET(request: NextRequest) {
  const { user, response } = await requireRoles(request, ['admin'])
  if (response) return response

  try {
    const { searchParams } = new URL(request.url)
    const vendorId = searchParams.get('vendorId')

    let orders
    if (vendorId) {
      orders = await getOrdersByVendor(vendorId)
    } else {
      orders = await getOrders({})
    }

    return NextResponse.json({
      success: true,
      data: orders
    })
  } catch (error) {
    console.error('Orders API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}