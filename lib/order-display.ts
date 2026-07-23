// Shared by the customer order page, the vendor orders list, and the vendor order
// detail modal — all three need "what delivery fee applies to this one vendor's card"
// for a multi-vendor order, where each vendor's item shipped from a different address
// at a different real cost (an Ikeja store and a Lekki store don't pay the same fee).

export type VendorOrderEntry = {
  total?: number
  shippingFee?: number | null
}

export type OrderLike = {
  totalAmount?: number
  vendors?: VendorOrderEntry[]
}

/**
 * Real per-vendor delivery fee if the order stored one (computed from that vendor's own
 * pickup address at checkout — see estimateShippingFee in app/api/payments/initialize).
 * Falls back to an even split across vendors only for legacy orders that predate this
 * field, since we no longer have each vendor's individual distance-based fee to use.
 */
export function computeVendorDeliveryFee(order: OrderLike, vendorRow?: VendorOrderEntry | null): number {
  if (vendorRow && Number.isFinite(Number(vendorRow.shippingFee))) {
    return Math.max(0, Number(vendorRow.shippingFee))
  }

  const grossTotal = Number.isFinite(Number(order?.totalAmount)) ? Number(order.totalAmount) : 0
  const vendors = Array.isArray(order?.vendors) ? order.vendors : []

  if (vendors.length <= 1) {
    // Single vendor (or a legacy order with no vendors[] at all) — nothing to split,
    // this is the whole order's delivery fee.
    const productSubtotal = vendorRow && Number.isFinite(Number(vendorRow.total))
      ? Number(vendorRow.total)
      : Number(vendors[0]?.total || 0)
    return Math.max(0, grossTotal - productSubtotal)
  }

  // Multi-vendor, but this entry has no real shippingFee recorded (order predates the
  // field) — split whatever isn't accounted for by product totals evenly across
  // vendors as the least-wrong fallback.
  const combinedProductSubtotal = vendors.reduce((sum, v) => sum + Number(v?.total || 0), 0)
  const combinedRemainder = Math.max(0, grossTotal - combinedProductSubtotal)
  return combinedRemainder / vendors.length
}
