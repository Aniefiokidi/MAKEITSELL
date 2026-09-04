// Shared order-building logic — used by BOTH the web checkout flow
// (app/api/payments/initialize/route.ts) and the WhatsApp bot's service-role
// order-creation path (lib/whatsapp/buyer-orders.ts). Building an order — grouping
// items by vendor/store, computing subtotal/VAT/shipping, resolving courier
// selections, computing delivery type and the initial escrow-release estimate — must
// stay identical between the two callers, or a web order and a bot order could
// silently diverge in pricing or fulfillment.
//
// Scope is deliberately narrow: this only gets an order INTO the database at
// paymentStatus: 'pending'. Nothing about payment (Paystack/Bach/wallet) lives here —
// callers handle that themselves afterward, exactly like the original inline logic did.
import { v4 as uuidv4 } from 'uuid'
import connectToDatabase from '@/lib/mongodb'
import { Store } from '@/lib/models/Store'
import { Product } from '@/lib/models/Product'
import { createOrder } from '@/lib/mongodb-operations'
import { ESCROW_DISPUTE_GRACE_HOURS } from '@/lib/shipbubble'
import { normalizeProductVariants } from '@/lib/product-variants'

const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/
function isValidObjectIdString(value: string): boolean {
  return OBJECT_ID_REGEX.test(String(value || '').trim())
}

export type BuildOrderInput = {
  customerId: string
  items: any[]
  shippingInfo: any
  paymentMethod: string
  // Keyed by vendorId, each value is { provider, quoteRef, total, etaHours? } — captured
  // at checkout from the merged multi-provider quote list (lib/logistics/engine.ts).
  courierSelections?: Record<string, any>
}

export type BuildOrderResult =
  | { success: true; orderId: string; totalAmount: number }
  | { success: false; error: string; status: number }

export async function buildOrder(input: BuildOrderInput): Promise<BuildOrderResult> {
  const { customerId, items, shippingInfo, paymentMethod, courierSelections } = input

  // Same hard-required set the inline route logic checked: items, shippingInfo,
  // customerId, shippingInfo.email, shippingInfo.deliveryInstructions. Everything else
  // in shippingInfo (name, phone, address, city, state...) is NOT enforced here — it
  // only ever mattered because the web checkout form marked it required client-side,
  // and because a real address is needed to have gotten a courier selection in the
  // first place (enforced below, indirectly, via missingCourierVendors).
  if (!items || !shippingInfo || !customerId || !shippingInfo.email || !String(shippingInfo.deliveryInstructions || '').trim()) {
    console.error('[order-creation] Missing required fields:', {
      hasItems: Boolean(items),
      hasShippingInfo: Boolean(shippingInfo),
      customerId,
      email: shippingInfo?.email,
      deliveryInstructions: shippingInfo?.deliveryInstructions,
    })
    return {
      success: false,
      error: 'Missing required fields (items, shippingInfo, customerId, email, deliveryInstructions)',
      status: 400,
    }
  }

  await connectToDatabase()

  // Fast-fail check for any item with a variant selected (a compatible device model, a
  // color, a size, ...). This is a UX nicety, not the real correctness guarantee — two
  // simultaneous buyers could still both pass this check for the last unit; the actual
  // race-safe guard is the atomic findOneAndUpdate in lib/product-stock.ts, run later at
  // payment-confirmation time. This just avoids charging a customer for a variant value
  // that's already visibly out of stock.
  const variantItems = (Array.isArray(items) ? items : []).filter(
    (item: any) => Array.isArray(item?.selectedVariants) && item.selectedVariants.length > 0
  )
  if (variantItems.length > 0) {
    const productIds = Array.from(
      new Set(variantItems.map((item: any) => String(item.productId || '').trim()).filter(isValidObjectIdString))
    )
    const variantProducts = productIds.length > 0 ? await Product.find({ _id: { $in: productIds } }).lean() : []
    const productById = new Map(variantProducts.map((p: any) => [String(p._id), p]))
    for (const item of variantItems) {
      const product = productById.get(String(item.productId || '').trim())
      const productVariants = normalizeProductVariants(product)
      for (const selected of item.selectedVariants) {
        const variantStock =
          productVariants.find((v) => v.label === selected.label && v.value === selected.value)?.stock ?? 0
        if (variantStock < Number(item?.quantity || 0)) {
          return {
            success: false,
            error: `${item.title || 'This item'} (${selected.label}: ${selected.value}) only has ${variantStock} in stock.`,
            status: 409,
          }
        }
      }
    }
  }

  const orderId = uuidv4()

  // Group items by store first (fallback to vendor) so each store gets its own payout bucket.
  const vendorOrders = new Map()

  for (const item of items) {
    const vendorId = String(item?.vendorId || '').trim()
    let storeId = String(item?.storeId || '').trim()
    if (!storeId && item.productId) {
      try {
        const productRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/database/products/${item.productId}`)
        if (productRes.ok) {
          const productJson = await productRes.json()
          if (productJson.success && productJson.data && productJson.data.storeId) {
            storeId = String(productJson.data.storeId || '').trim()
          }
        }
      } catch {}
    }
    const groupingKey = storeId ? `store:${storeId}` : `vendor:${vendorId}`
    if (!vendorOrders.has(groupingKey)) {
      vendorOrders.set(groupingKey, {
        vendorId,
        vendorName: item.vendorName,
        storeId,
        items: [],
        total: 0,
      })
    }
    const vendor = vendorOrders.get(groupingKey)
    if (!vendor.storeId && storeId) {
      vendor.storeId = storeId
    }
    vendor.items.push({ ...item, storeId })
    vendor.total += Number(item?.price || 0) * Number(item?.quantity || 0)
  }

  const subtotal = (Array.isArray(items) ? items : []).reduce((sum: number, item: any) => {
    return sum + (Number(item?.price || 0) * Number(item?.quantity || 0))
  }, 0)
  const vat = Math.round(subtotal * 0.07)

  const vendorEntries = Array.from(vendorOrders.values()) as any[]
  const vendorIdList = Array.from(new Set(vendorEntries.map((v) => String(v?.vendorId || '').trim()).filter(Boolean)))
  const storeIdList = Array.from(new Set(vendorEntries.map((v) => String(v?.storeId || '').trim()).filter(isValidObjectIdString)))

  const storeQueryOr: any[] = []
  if (storeIdList.length > 0) storeQueryOr.push({ _id: { $in: storeIdList } })
  if (vendorIdList.length > 0) storeQueryOr.push({ vendorId: { $in: vendorIdList } })

  let stores: any[] = []
  if (storeQueryOr.length > 0) {
    stores = await Store.find({ $or: storeQueryOr }).lean()
  }

  const storeById = new Map<string, any>()
  const storeByVendorId = new Map<string, any>()
  for (const store of stores || []) {
    storeById.set(String(store?._id || ''), store)
    if (store?.vendorId && !storeByVendorId.has(String(store.vendorId))) {
      storeByVendorId.set(String(store.vendorId), store)
    }
  }

  // Real courier selections captured at checkout (or by the bot's future delivery-
  // selection step) — each vendor must have picked a Shipbubble courier before an order
  // can be created. There is no server-side fallback rate lookup here: trusting the
  // already-quoted total the customer saw mirrors how `resolvedShipping` already worked
  // client-side on the web checkout page.
  let shipping = 0
  const missingCourierVendors: string[] = []
  // Highest parsed courier ETA across all vendors in this order — release can't happen
  // until every vendor's leg is confirmed delivered, so the slowest courier governs.
  let maxCourierEtaHours: number | null = null

  for (const vendor of Array.from(vendorOrders.values()) as any[]) {
    const store = storeById.get(String(vendor?.storeId || '')) || storeByVendorId.get(String(vendor?.vendorId || ''))
    const pickupAddress = String(store?.address || '')
    vendor.storeId = vendor.storeId || store?._id?.toString?.() || ''
    vendor.storeAddress = pickupAddress || ''
    vendor.storeState = String(store?.state || '')

    const selection = courierSelections?.[vendor.vendorId]
    const provider = String(selection?.provider || '').trim()
    const quoteRef = String(selection?.quoteRef || '').trim()
    const shippingFee = Number(selection?.total)

    if (!provider || !quoteRef || !Number.isFinite(shippingFee)) {
      missingCourierVendors.push(vendor.vendorName || vendor.vendorId)
      continue
    }

    vendor.shippingFee = shippingFee
    vendor.shippingFeeLabel = shippingFee === 0 ? 'FREE' : `NGN ${shippingFee.toLocaleString('en-NG')}`

    // Provider-agnostic fields — what order-dispatch.ts and the cancel route read for
    // any provider going forward.
    vendor.deliveryProvider = provider
    vendor.deliveryQuoteRef = quoteRef
    const etaHours = selection?.etaHours != null ? Number(selection.etaHours) : null
    vendor.deliveryEtaHours = etaHours

    // Legacy Shipbubble-specific fields, kept ONLY for shipbubble legs — pure backward
    // compatibility so every existing reader (the Shipbubble webhook's order lookup, the
    // cancel route, app/order/page.tsx's tracking link) keeps working unmodified for
    // Shipbubble orders without needing to know about the new generic fields at all.
    if (provider === 'shipbubble') {
      try {
        const parsed = JSON.parse(quoteRef) as { requestToken?: string; serviceCode?: string; courierId?: string }
        vendor.shipbubbleRequestToken = parsed.requestToken || ''
        vendor.shipbubbleServiceCode = parsed.serviceCode || ''
        vendor.shipbubbleCourierId = parsed.courierId || ''
      } catch {
        // Malformed quoteRef — leave legacy fields unset rather than throw; the generic
        // fields above still carry everything order-dispatch.ts needs to book this leg.
      }
      vendor.shipbubbleCourierName = String(selection?.courierName || '')
      vendor.shipbubbleDeliveryEtaHours = etaHours
    }

    shipping += shippingFee
    if (etaHours != null && (maxCourierEtaHours == null || etaHours > maxCourierEtaHours)) {
      maxCourierEtaHours = etaHours
    }
  }

  if (missingCourierVendors.length > 0) {
    return {
      success: false,
      error: `Please select a delivery courier for: ${missingCourierVendors.join(', ')}`,
      status: 400,
    }
  }

  const hasTbdShipping = false
  const computedTotalAmount = subtotal + vat + shipping

  const normalizedDropoffState = String(shippingInfo?.state || '').trim().toLowerCase()
  const vendorStates = vendorEntries
    .map((entry: any) => String(entry?.storeState || entry?.state || '').trim().toLowerCase())
    .filter(Boolean)
  const deliveryType: 'local' | 'interstate' = (
    normalizedDropoffState
    && vendorStates.length > 0
    && vendorStates.every((state) => state === normalizedDropoffState)
  ) ? 'local' : 'interstate'

  // Escrow release timing: courier ETA (from the rate actually picked) plus a fixed
  // dispute grace period. Falls back to a local/interstate default only if no courier
  // ETA could be parsed. This is just the initial estimate; the Shipbubble webhook
  // tightens it once delivery is actually confirmed.
  const estimatedDeliveryHours = maxCourierEtaHours ?? (deliveryType === 'local' ? 14 : 72)
  const escrowReleaseAt = new Date(Date.now() + (estimatedDeliveryHours + ESCROW_DISPUTE_GRACE_HOURS) * 60 * 60 * 1000)

  const storeIds = Array.from(vendorOrders.values()).map((v) => v.storeId).filter(Boolean)
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
      country: shippingInfo.country,
      instructions: shippingInfo.deliveryInstructions,
    },
    paymentMethod,
    subtotal,
    vat,
    shipping,
    hasTbdShipping,
    totalAmount: computedTotalAmount,
    status: 'pending_payment',
    paymentStatus: 'pending',
    deliveryType,
    escrowReleaseAt,
    vendors: Array.from(vendorOrders.values()),
    storeIds,
    createdAt: new Date(),
  }

  await createOrder(orderData)

  return { success: true, orderId, totalAmount: computedTotalAmount }
}
