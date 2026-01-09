import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { paystackService } from '@/lib/payment'
import { createOrder } from '@/lib/mongodb-operations'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Payment API received:', body)
    
    const {
      items,
      shippingInfo,
      paymentMethod,
      customerId,
      totalAmount
    } = body

    // Validate required fields
    if (!items || !shippingInfo || !customerId || !totalAmount || !shippingInfo.email) {
      console.error('Missing fields:', {
        items,
        shippingInfo,
        customerId,
        totalAmount,
        email: shippingInfo?.email
      })
      return NextResponse.json(
        { error: 'Missing required fields (items, shippingInfo, customerId, totalAmount, email)' },
        { status: 400 }
      )
    }

    // Generate unique order ID
    const orderId = uuidv4()

    // Group items by vendor
    const vendorOrders = new Map()
    
    for (const item of items) {
      const vendorId = item.vendorId
      // Try to get storeId from item, fallback to product lookup if missing
      let storeId = item.storeId
      if (!storeId && item.productId) {
        // Fetch product to get storeId
        try {
          const productRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/database/products/${item.productId}`)
          if (productRes.ok) {
            const productJson = await productRes.json();
            if (productJson.success && productJson.data && productJson.data.storeId) {
              storeId = productJson.data.storeId;
            }
          }
        } catch {}
      }
      if (!vendorOrders.has(vendorId)) {
        vendorOrders.set(vendorId, {
          vendorId,
          vendorName: item.vendorName,
          storeId,
          items: [],
          total: 0
        })
      }
      const vendor = vendorOrders.get(vendorId)
      vendor.items.push({ ...item, storeId })
      vendor.total += item.price * item.quantity
    }

    // Create order record in database
    // Collect all unique storeIds from vendorOrders
    const storeIds = Array.from(vendorOrders.values()).map(v => v.storeId).filter(Boolean)
    const orderData = {
      orderId,
      customerId,
      items,
      shippingInfo,
      shippingAddress: {
        street: shippingInfo.address,
        city: shippingInfo.city,
        state: shippingInfo.state,
        zipCode: shippingInfo.zipCode,
        country: shippingInfo.country
      },
      paymentMethod,
      totalAmount,
      status: 'pending_payment',
      paymentStatus: 'pending',
      vendors: Array.from(vendorOrders.values()),
      storeIds,
      createdAt: new Date()
    }

    console.log('Creating order with data:', orderData)
    const order = await createOrder(orderData)
    console.log('Order created successfully:', order)

    // Initialize payment with Paystack
    if (paymentMethod === 'paystack') {
      console.log('Initializing Paystack payment with data:', {
        email: shippingInfo.email,
        amount: totalAmount,
        orderId,
        customerId,
        itemCount: items.length
      })
      
      const origin = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).trim()
      const paymentResult = await paystackService.initializePayment({
        email: shippingInfo.email,
        amount: totalAmount,
        orderId,
        customerId,
        callbackUrl: `${origin}/api/payments/verify`,
        items
      })

      console.log('Paystack result:', paymentResult)
      if (!paymentResult.success) {
        console.error('Full Paystack error response:', paymentResult)
      }

      if (paymentResult.success) {
        const response = {
          success: true,
          orderId,
          authorization_url: paymentResult.authUrl,
          reference: paymentResult.data?.reference
        }
        console.log('API returning successful response:', response)
        return NextResponse.json(response)
      }

      return NextResponse.json(
        { error: paymentResult.message || 'Payment initialization failed', paystack: paymentResult },
        { status: 400 }
      )
    }

    // For other payment methods (can be extended)
    return NextResponse.json({
      success: true,
      orderId,
      message: 'Order created successfully'
    })

  } catch (error) {
    console.error('Payment initialization error:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    })
    return NextResponse.json(
      { error: 'Failed to initialize payment' },
      { status: 500 }
    )
  }
}