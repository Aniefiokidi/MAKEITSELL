// LogisticsProvider adapter wrapping the existing, untouched Shipbubble client
// (lib/shipbubble.ts) — pure translation into the provider-agnostic shape, zero behavior
// change for the Shipbubble path itself.
import {
  validateShipbubbleAddress,
  getOrCreateStoreAddressCode,
  fetchShipbubbleRates,
  mapProductCategoryToShipbubbleCategoryId,
  ensureTwoWordName,
  createShipbubbleShipment,
  cancelShipbubbleShipment,
  parseDeliveryEtaToHours,
  DEFAULT_WEIGHT_KG,
  type ShipbubblePackageItem,
} from '@/lib/shipbubble'
import type { BookingContext, CourierQuote, LogisticsProvider, LogisticsQuoteParams, ShipmentBookingResult } from '../types'

type ShipbubbleQuoteRef = { requestToken: string; serviceCode: string; courierId: string }

export const shipbubbleProvider: LogisticsProvider = {
  id: 'shipbubble',

  isEnabled() {
    return Boolean(String(process.env.SHIPBUBBLE_API_KEY || '').trim())
  },

  async getQuotes(params: LogisticsQuoteParams): Promise<CourierQuote[]> {
    if (!this.isEnabled()) return []

    const receiverValidation = await validateShipbubbleAddress({
      name: ensureTwoWordName(params.receiver.name, 'Buyer'),
      email: params.receiver.email || 'customer@makeitsell.ng',
      phone: params.receiver.phone,
      address: [params.receiver.address, params.receiver.city, params.receiver.state, 'Nigeria'].filter(Boolean).join(', '),
    })
    if (!receiverValidation) return []

    const senderAddressCode = await getOrCreateStoreAddressCode(params.store._id)
    if (!senderAddressCode) return []

    const categoryId = await mapProductCategoryToShipbubbleCategoryId(params.productCategory)
    if (!categoryId) return []

    const packageItems: ShipbubblePackageItem[] = params.packageItems.map((item) => ({
      name: item.name.slice(0, 100),
      description: item.name.slice(0, 100),
      unit_weight: String(item.unitWeightKg > 0 ? item.unitWeightKg : DEFAULT_WEIGHT_KG),
      unit_amount: String(item.unitAmount),
      quantity: String(item.quantity),
    }))

    const rates = await fetchShipbubbleRates({
      senderAddressCode,
      receiverAddressCode: receiverValidation.addressCode,
      pickupDate: params.pickupDate,
      categoryId,
      packageItems,
    })
    if (!rates || rates.couriers.length === 0) return []

    return rates.couriers.map((c): CourierQuote => {
      const quoteRef: ShipbubbleQuoteRef = { requestToken: rates.requestToken, serviceCode: c.service_code, courierId: c.courier_id }
      return {
        provider: 'shipbubble',
        quoteRef: JSON.stringify(quoteRef),
        serviceLabel: `${c.courier_name} ${c.service_type}`.trim(),
        total: c.total,
        currency: c.currency,
        etaHours: parseDeliveryEtaToHours(c.delivery_eta),
        etaLabel: c.delivery_eta || '',
      }
    })
  },

  async bookShipment(quoteRef: string, _context: BookingContext): Promise<ShipmentBookingResult | null> {
    const parsed: ShipbubbleQuoteRef = JSON.parse(quoteRef)
    const shipment = await createShipbubbleShipment({
      requestToken: parsed.requestToken,
      serviceCode: parsed.serviceCode,
      courierId: parsed.courierId,
    })
    if (!shipment) return null
    return {
      providerOrderId: shipment.orderId,
      trackingUrl: shipment.trackingUrl,
      courierName: shipment.courierName,
      status: shipment.status,
    }
  },

  async cancelShipment(providerOrderId: string): Promise<boolean> {
    return cancelShipbubbleShipment(providerOrderId)
  },
}
