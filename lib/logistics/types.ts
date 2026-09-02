// Provider-agnostic shape for a single deliverable quote, and the interface every
// logistics provider adapter implements. See lib/logistics/engine.ts for how these get
// merged across providers, and lib/logistics/providers/*.ts for the adapters themselves.
export type LogisticsProviderId = 'shipbubble' | 'kwik' | 'fez'

export type CourierQuote = {
  provider: LogisticsProviderId
  // Opaque, provider-specific JSON blob carrying everything that provider's own
  // bookShipment() needs to recreate this exact quote later (after payment confirms).
  // Never inspected outside that provider's own adapter/client.
  quoteRef: string
  // Internal-only label (e.g. "GIGL Standard", "Kwik Bike") — never shown to the buyer,
  // who only ever sees the Express/Standard framing computed in lib/logistics/engine.ts.
  serviceLabel: string
  total: number
  currency: string
  etaHours: number | null
  etaLabel: string
}

// `store` is the raw Mongoose-loaded Store doc (not just an address string) so each
// provider can do its own store-scoped resolution + caching on the Store document itself —
// Shipbubble caches an address_code (lib/shipbubble.ts's getOrCreateStoreAddressCode),
// Kwik caches geocoded lat/lng (see lib/logistics/providers/kwik.ts) — the same pattern,
// just a different cached shape per provider.
export type LogisticsQuoteParams = {
  store: { _id: string; storeName?: string; address: string; city?: string; state?: string; phone: string; email: string; vendorId?: string }
  receiver: { name: string; email: string; phone: string; address: string; city: string; state: string }
  packageItems: Array<{ name: string; unitWeightKg: number; unitAmount: number; quantity: number }>
  productCategory: string
  pickupDate: string // yyyy-mm-dd
}

export type ShipmentBookingResult = {
  providerOrderId: string
  trackingUrl: string
  courierName: string
  status: string
}

// Our own order/vendor identifiers, passed alongside quoteRef at booking time — needed by
// providers (Fez) whose order-creation call requires a caller-supplied unique ID, so a
// support agent can correlate a provider's own order number back to a MakeItSell order.
// Shipbubble/Kwik don't need this (their booking calls key off the quote itself) and can
// ignore it.
export type BookingContext = { orderId: string; vendorId: string }

export interface LogisticsProvider {
  id: LogisticsProviderId
  isEnabled(): boolean
  getQuotes(params: LogisticsQuoteParams): Promise<CourierQuote[]>
  bookShipment(quoteRef: string, context: BookingContext): Promise<ShipmentBookingResult | null>
  cancelShipment(providerOrderId: string): Promise<boolean>
}
