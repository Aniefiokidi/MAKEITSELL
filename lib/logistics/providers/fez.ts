// LogisticsProvider adapter for Fez (lib/fez.ts). Simplest of the three adapters — no
// address validation (Shipbubble) or geocoding (Kwik) needed; Fez prices purely on
// destination state + weight, and IS the courier (no per-courier options to pick between).
import {
  isFezConfigured,
  getFezDeliveryCost,
  createFezOrder,
  cancelFezOrder,
} from '@/lib/fez'
import type { BookingContext, CourierQuote, LogisticsProvider, LogisticsQuoteParams, ShipmentBookingResult } from '../types'

type FezQuoteRef = {
  recipientName: string
  recipientPhone: string
  recipientEmail?: string
  recipientAddress: string
  recipientState: string
  senderName: string
  senderPhone: string
  senderAddress: string
  itemDescription: string
  valueOfItem: number
  weightKg: number
}

// Fez's /states endpoint (confirmed live) uses bare "FCT" — our internal state values
// sometimes carry "Abuja" or "FCT (Abuja)" depending on which picker produced them.
function normalizeFezState(state: string): string {
  const s = state.trim()
  if (/^(abuja|fct\b.*)/i.test(s)) return 'FCT'
  return s
}

export const fezProvider: LogisticsProvider = {
  id: 'fez',

  isEnabled() {
    return isFezConfigured()
  },

  async getQuotes(params: LogisticsQuoteParams): Promise<CourierQuote[]> {
    if (!this.isEnabled()) return []

    const totalWeightKg = params.packageItems.reduce((sum, item) => sum + item.unitWeightKg * item.quantity, 0)
    const recipientState = normalizeFezState(params.receiver.state)

    const cost = await getFezDeliveryCost(recipientState, totalWeightKg)
    if (!cost) return []

    const valueOfItem = params.packageItems.reduce((sum, item) => sum + item.unitAmount * item.quantity, 0)
    const itemDescription = params.packageItems.map((i) => i.name).join(', ').slice(0, 200) || 'Order items'

    const quoteRef: FezQuoteRef = {
      recipientName: params.receiver.name,
      recipientPhone: params.receiver.phone,
      recipientEmail: params.receiver.email,
      recipientAddress: [params.receiver.address, params.receiver.city].filter(Boolean).join(', '),
      recipientState,
      senderName: params.store.storeName || 'Vendor',
      senderPhone: params.store.phone,
      senderAddress: [params.store.address, params.store.city, params.store.state].filter(Boolean).join(', '),
      itemDescription,
      valueOfItem,
      weightKg: totalWeightKg,
    }

    return [
      {
        provider: 'fez',
        quoteRef: JSON.stringify(quoteRef),
        serviceLabel: 'Fez Delivery',
        total: cost.totalCost,
        currency: cost.currency,
        // Fez's cost endpoint exposes no ETA field — competes on price only, same
        // treatment as Kwik until there's a real number to show.
        etaHours: null,
        etaLabel: '',
      },
    ]
  },

  async bookShipment(quoteRef: string, context: BookingContext): Promise<ShipmentBookingResult | null> {
    const parsed: FezQuoteRef = JSON.parse(quoteRef)
    const order = await createFezOrder({
      uniqueID: `${context.orderId}-${context.vendorId}`,
      batchID: context.orderId,
      recipientName: parsed.recipientName,
      recipientPhone: parsed.recipientPhone,
      recipientEmail: parsed.recipientEmail,
      recipientAddress: parsed.recipientAddress,
      recipientState: parsed.recipientState,
      senderName: parsed.senderName,
      senderPhone: parsed.senderPhone,
      senderAddress: parsed.senderAddress,
      itemDescription: parsed.itemDescription,
      valueOfItem: parsed.valueOfItem,
      weightKg: parsed.weightKg,
    })
    if (!order) return null

    return {
      providerOrderId: order.orderNo,
      // Fez exposes no public tracking-page URL (confirmed via their /order/track docs
      // — it's a GET-polled API, not a hosted page) — left blank; the buyer relies on
      // status updates pushed via the Fez webhook instead.
      trackingUrl: '',
      courierName: 'Fez',
      status: 'pending',
    }
  },

  async cancelShipment(providerOrderId: string): Promise<boolean> {
    return cancelFezOrder(providerOrderId, 'Cancelled via MakeItSell')
  },
}
