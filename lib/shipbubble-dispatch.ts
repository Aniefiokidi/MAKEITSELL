// Turns a paid order's per-vendor rate selections (captured at checkout, stored on
// Order.vendors[] by app/api/payments/initialize/route.ts) into real Shipbubble
// shipments. Called once payment is confirmed — there are three such points (Paystack
// verify, Bach callback, wallet-immediate) since this app has no single "payment
// confirmed" choke point; see each call site for why.
import connectToDatabase from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { createShipbubbleShipment } from '@/lib/shipbubble'

export async function createShipmentsForOrder(orderId: string): Promise<void> {
  await connectToDatabase()

  const order: any = await Order.findOne({ orderId }).lean()
  if (!order || !Array.isArray(order.vendors)) return

  for (const vendor of order.vendors) {
    const vendorId = String(vendor?.vendorId || '').trim()
    const requestToken = String(vendor?.shipbubbleRequestToken || '').trim()
    const serviceCode = String(vendor?.shipbubbleServiceCode || '').trim()
    const courierId = String(vendor?.shipbubbleCourierId || '').trim()
    const alreadyDispatched = Boolean(vendor?.shipbubbleOrderId)

    if (!vendorId || !requestToken || !serviceCode || !courierId || alreadyDispatched) continue

    try {
      const shipment = await createShipbubbleShipment({ requestToken, serviceCode, courierId })
      if (!shipment) {
        console.error(`[shipbubble-dispatch] Shipment creation failed for order ${orderId}, vendor ${vendorId} — no shipment returned`)
        continue
      }

      await Order.updateOne(
        { orderId, 'vendors.vendorId': vendorId },
        {
          $set: {
            'vendors.$[entry].shipbubbleOrderId': shipment.orderId,
            'vendors.$[entry].shipbubbleTrackingUrl': shipment.trackingUrl,
            'vendors.$[entry].shipbubbleCourierName': shipment.courierName,
            'vendors.$[entry].shipbubbleStatus': shipment.status,
            'vendors.$[entry].status': 'confirmed',
            'vendors.$[entry].confirmedAt': new Date(),
          },
        },
        { arrayFilters: [{ 'entry.vendorId': vendorId }] }
      )
    } catch (error) {
      // Best-effort per vendor — one vendor's dispatch failing shouldn't block the
      // others, or the payment-confirmation flow that called this.
      console.error(`[shipbubble-dispatch] Failed to create shipment for order ${orderId}, vendor ${vendorId}:`, error)
    }
  }
}
