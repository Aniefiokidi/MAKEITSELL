// Turns a paid order's per-vendor courier selections (captured at checkout, stored on
// Order.vendors[] by lib/order-creation.ts) into real shipments with whichever logistics
// provider was actually selected (lib/logistics/engine.ts). Called once payment is
// confirmed — there are three such points (Paystack verify, Bach callback, wallet-
// immediate) since this app has no single "payment confirmed" choke point; see each call
// site for why. Formerly lib/shipbubble-dispatch.ts, back when Shipbubble was the only
// provider.
import connectToDatabase from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { findLogisticsProvider } from '@/lib/logistics/engine'
import type { LogisticsProviderId } from '@/lib/logistics/types'

// Pre-migration orders (created before the multi-provider generalization) only have the
// legacy shipbubble* fields, not deliveryProvider/deliveryQuoteRef — reconstruct the
// quoteRef JSON from them on the fly so an order already sitting at paymentStatus:
// 'pending' when this shipped still dispatches correctly.
function resolveProviderAndQuoteRef(vendor: any): { provider: LogisticsProviderId; quoteRef: string } | null {
  const provider = (vendor?.deliveryProvider || 'shipbubble') as LogisticsProviderId
  let quoteRef = String(vendor?.deliveryQuoteRef || '').trim()

  if (!quoteRef && provider === 'shipbubble') {
    const requestToken = String(vendor?.shipbubbleRequestToken || '').trim()
    const serviceCode = String(vendor?.shipbubbleServiceCode || '').trim()
    const courierId = String(vendor?.shipbubbleCourierId || '').trim()
    if (requestToken && serviceCode && courierId) {
      quoteRef = JSON.stringify({ requestToken, serviceCode, courierId })
    }
  }

  return quoteRef ? { provider, quoteRef } : null
}

export async function createShipmentsForOrder(orderId: string): Promise<void> {
  await connectToDatabase()

  const order: any = await Order.findOne({ orderId }).lean()
  if (!order || !Array.isArray(order.vendors)) return

  for (const vendor of order.vendors) {
    const vendorId = String(vendor?.vendorId || '').trim()

    const alreadyDispatched = Boolean(vendor?.deliveryProviderOrderId || vendor?.shipbubbleOrderId)
    if (!vendorId || alreadyDispatched) continue

    const resolved = resolveProviderAndQuoteRef(vendor)
    if (!resolved) continue

    const provider = findLogisticsProvider(resolved.provider)
    if (!provider) {
      console.error(`[order-dispatch] Unknown provider "${resolved.provider}" for order ${orderId}, vendor ${vendorId}`)
      continue
    }

    try {
      const shipment = await provider.bookShipment(resolved.quoteRef, { orderId, vendorId })
      if (!shipment) {
        console.error(`[order-dispatch] Shipment creation failed for order ${orderId}, vendor ${vendorId} (${resolved.provider}) — no shipment returned`)
        continue
      }

      const setFields: Record<string, any> = {
        'vendors.$[entry].deliveryProvider': resolved.provider,
        'vendors.$[entry].deliveryProviderOrderId': shipment.providerOrderId,
        'vendors.$[entry].deliveryTrackingUrl': shipment.trackingUrl,
        'vendors.$[entry].deliveryStatus': shipment.status,
        'vendors.$[entry].status': 'confirmed',
        'vendors.$[entry].confirmedAt': new Date(),
      }
      // Legacy mirror, Shipbubble only — every existing reader of these exact field
      // names (the Shipbubble webhook's order lookup, the cancel route, the buyer
      // tracking page) keeps working unmodified.
      if (resolved.provider === 'shipbubble') {
        setFields['vendors.$[entry].shipbubbleOrderId'] = shipment.providerOrderId
        setFields['vendors.$[entry].shipbubbleTrackingUrl'] = shipment.trackingUrl
        setFields['vendors.$[entry].shipbubbleCourierName'] = shipment.courierName
        setFields['vendors.$[entry].shipbubbleStatus'] = shipment.status
      }

      await Order.updateOne(
        { orderId, 'vendors.vendorId': vendorId },
        { $set: setFields },
        { arrayFilters: [{ 'entry.vendorId': vendorId }] }
      )
    } catch (error) {
      // Best-effort per vendor — one vendor's dispatch failing shouldn't block the
      // others, or the payment-confirmation flow that called this.
      console.error(`[order-dispatch] Failed to create shipment for order ${orderId}, vendor ${vendorId} (${resolved.provider}):`, error)
    }
  }
}
