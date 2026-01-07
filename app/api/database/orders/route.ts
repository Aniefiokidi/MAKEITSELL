import { NextRequest, NextResponse } from "next/server"
import { getOrdersByVendor, getAllOrders } from "@/lib/mongodb-operations"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const vendorId = searchParams.get('vendorId')

    let orders
    if (vendorId) {
      orders = await getOrdersByVendor(vendorId)
    } else {
      orders = await getAllOrders()
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