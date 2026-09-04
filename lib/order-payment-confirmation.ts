// Shared "order successfully paid" downstream logic — called from BOTH payment-
// confirmation paths: the browser-redirect flow (app/api/payments/verify/route.ts) and
// the real server-to-server Paystack webhook (app/api/payments/webhook/route.ts,
// charge.success). Both can fire for the same order — Paystack calls the webhook
// independently of whether the customer's browser ever completes the redirect — so this
// function must be safe to call more than once for the same order and only perform its
// side effects (courier dispatch, vendor notification, stock/sales decrement, customer/
// vendor notifications) exactly once.
import connectToDatabase from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { createShipmentsForOrder } from '@/lib/order-dispatch'
import { notifyVendorsNewOrder } from '@/lib/whatsapp/notifications'
import { notifyWaBuyerOrderPaid } from '@/lib/whatsapp/checkout'
import { sendOrderPlacementNotifications } from '@/lib/order-notifications'
import { decrementProductStockForOrderItem } from '@/lib/product-stock'

// Any status at or past "paid" — a caller arriving after one of these is already set
// means some earlier call already claimed this order, so skip every downstream side
// effect rather than repeat them.
const ALREADY_PAID_STATUSES = ['escrow', 'completed', 'released', 'refunded']

// Delegates per-item to the shared lib/product-stock.ts helper (also used by the wallet
// and Bach payment-confirmation paths), which additionally handles a race-safe atomic
// decrement when an item carries selectedVariants.
async function decrementStockAndSales(order: any): Promise<void> {
  if (!order || !(order.items || order.vendors)) return

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
}

/**
 * Runs exactly once per order no matter how many times, or from which of the two
 * confirmation paths, it's called. The findOneAndUpdate below IS the idempotency guard:
 * its filter only matches an order whose paymentStatus hasn't already reached a paid
 * state, and MongoDB applies a document's filter+update as one atomic operation — so two
 * callers racing on the same orderId (verify redirect + webhook, or a duplicate delivery
 * of either) can never both "win" the claim. Only the caller that successfully flips the
 * status runs the downstream side effects; every other caller gets a no-op.
 */
export async function handleOrderPaid(
  orderId: string,
  paymentReference: string,
  paymentData: any
): Promise<{ claimed: boolean }> {
  await connectToDatabase()

  const claimedOrder: any = await Order.findOneAndUpdate(
    { orderId, paymentStatus: { $nin: ALREADY_PAID_STATUSES } },
    {
      $set: {
        status: 'confirmed',
        paymentStatus: 'escrow',
        paymentReference,
        paymentData,
        paidAt: new Date(),
      },
    },
    { new: false, lean: true }
  )

  if (!claimedOrder) {
    console.log(`[order-payment] handleOrderPaid: order ${orderId} not claimed (already paid, or no such order) — skipping downstream side effects`)
    return { claimed: false }
  }

  console.log(`[order-payment] handleOrderPaid: order ${orderId} claimed — running downstream side effects`)

  await createShipmentsForOrder(orderId).catch((err) => console.error('[order-payment] Shipbubble dispatch failed:', err))
  notifyVendorsNewOrder(orderId)
  notifyWaBuyerOrderPaid(String(claimedOrder.customerId || ''), orderId)
  await decrementStockAndSales(claimedOrder)
  await sendOrderPlacementNotifications(orderId, claimedOrder)

  return { claimed: true }
}
