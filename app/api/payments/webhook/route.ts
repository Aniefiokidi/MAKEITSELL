import { NextRequest, NextResponse } from 'next/server'
import { paystackService } from '@/lib/payment'
import { emailService } from '@/lib/email'
import { updateOrder, getOrderById } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-paystack-signature') || ''

    // Verify webhook signature
    const payload = JSON.parse(body)
    const isValid = paystackService.verifyWebhook(payload, signature)

    if (!isValid) {
      console.error('Invalid webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const { event, data } = payload

    switch (event) {
      case 'charge.success':
        await handleSuccessfulPayment(data)
        break
      
      case 'charge.failed':
        await handleFailedPayment(data)
        break
      
      case 'charge.dispute':
        await handleDispute(data)
        break
      
      default:
        console.log(`Unhandled webhook event: ${event}`)
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

async function handleSuccessfulPayment(data: any) {
  try {
    const orderId = data.metadata?.orderId
    
    if (!orderId) {
      console.error('Order ID not found in webhook data')
      return
    }

    // Update order status
    await updateOrder(orderId, {
      status: 'confirmed',
      paymentStatus: 'completed',
      paymentReference: data.reference,
      paymentData: data,
      paidAt: new Date()
    })

    // Get order details for email notifications
    const order = await getOrderById(orderId)
    
    if (order) {
      // Send confirmation emails to customer and vendors
      for (const vendor of order.vendors) {
        await emailService.sendOrderConfirmationEmails({
          customerEmail: order.shippingInfo.email,
          vendorEmail: vendor.vendorEmail || 'vendor@example.com',
          orderId,
          customerName: `${order.shippingInfo.firstName} ${order.shippingInfo.lastName}`,
          vendorName: vendor.vendorName,
          items: vendor.items,
          total: vendor.total,
          shippingAddress: order.shippingInfo
        })
      }
    }

    console.log(`Payment successful for order: ${orderId}`)
  } catch (error) {
    console.error('Error handling successful payment:', error)
  }
}

async function handleFailedPayment(data: any) {
  try {
    const orderId = data.metadata?.orderId
    
    if (!orderId) {
      console.error('Order ID not found in webhook data')
      return
    }

    // Update order status
    await updateOrder(orderId, {
      status: 'cancelled',
      paymentStatus: 'failed',
      paymentReference: data.reference,
      paymentData: data,
      cancelledAt: new Date()
    })

    console.log(`Payment failed for order: ${orderId}`)
  } catch (error) {
    console.error('Error handling failed payment:', error)
  }
}

async function handleDispute(data: any) {
  try {
    const orderId = data.metadata?.orderId
    
    if (!orderId) {
      console.error('Order ID not found in dispute data')
      return
    }

    // Update order with dispute information
    await updateOrder(orderId, {
      disputeStatus: 'active',
      disputeData: data,
      disputeAt: new Date()
    })

    // Notify administrators about the dispute
    // You can implement admin notification logic here

    console.log(`Payment dispute for order: ${orderId}`)
  } catch (error) {
    console.error('Error handling payment dispute:', error)
  }
}