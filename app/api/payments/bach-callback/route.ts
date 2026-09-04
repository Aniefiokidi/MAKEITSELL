import { NextRequest, NextResponse } from 'next/server'
import { bachService } from '@/lib/bach'
import { updateOrder, getOrderById } from '@/lib/mongodb-operations'
import { getCanonicalAppBaseUrl } from '@/lib/app-url'
import { sendOrderPlacementNotifications } from '@/lib/order-notifications'
import { decrementProductStockForOrderItem } from '@/lib/product-stock'
import { createShipmentsForOrder } from '@/lib/order-dispatch'
import { notifyVendorsNewOrder } from '@/lib/whatsapp/notifications'

const BACH_PAID_STATUSES = new Set(['PAID', 'COMPLETE', 'COMPLETED', 'SUCCESS', 'SUCCEEDED'])

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const appBaseUrl = getCanonicalAppBaseUrl(origin)
  const checkoutId = searchParams.get('checkout_id')

  if (!checkoutId) {
    return NextResponse.redirect(new URL('/checkout?error=missing_checkout_id', appBaseUrl).toString())
  }

  try {
    const session = await bachService.getCheckoutSession(checkoutId)

    if (!session) {
      return NextResponse.redirect(new URL('/checkout?error=session_not_found', appBaseUrl).toString())
    }

    const orderId = session.reference || session.metadata?.order_id
    if (!orderId) {
      return NextResponse.redirect(new URL('/checkout?error=missing_order_reference', appBaseUrl).toString())
    }

    if (!BACH_PAID_STATUSES.has(String(session.status || '').toUpperCase())) {
      return NextResponse.redirect(
        new URL(`/checkout?error=payment_incomplete`, appBaseUrl).toString()
      )
    }

    const order = await getOrderById(orderId)

    await updateOrder(orderId, {
      status: 'confirmed',
      paymentStatus: 'escrow',
      paymentReference: checkoutId,
      paymentData: { provider: 'bach', checkoutId, sessionStatus: session.status },
      paidAt: new Date(),
    })
    await createShipmentsForOrder(orderId).catch((err) => console.error('[bach-callback] Shipbubble dispatch failed:', err))
    notifyVendorsNewOrder(orderId)

    if (order && (order.items || order.vendors)) {
      try {
        const items: any[] = [
          ...(Array.isArray(order.items) ? order.items : []),
          ...(Array.isArray(order.vendors)
            ? order.vendors.flatMap((v: any) => (Array.isArray(v.items) ? v.items : []))
            : []),
        ]
        for (const item of items) {
          await decrementProductStockForOrderItem({
            productId: item.productId,
            quantity: item.quantity || 1,
            selectedVariants: item.selectedVariants,
          })
        }
      } catch (err) {
        console.error('[BACH CALLBACK] Stock update error:', err)
      }
    }

    if (order) {
      await sendOrderPlacementNotifications(orderId, order)
    }

    const redirectUrl = new URL('/order-confirmation', appBaseUrl)
    redirectUrl.searchParams.set('orderId', orderId)
    return NextResponse.redirect(redirectUrl.toString())
  } catch (error) {
    console.error('[BACH CALLBACK] Error:', error)
    return NextResponse.redirect(new URL('/checkout?error=callback_error', appBaseUrl).toString())
  }
}
