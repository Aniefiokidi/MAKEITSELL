// Shared delivery-quote logic — used by BOTH the web checkout flow
// (app/api/delivery/shipbubble-rates/route.ts) and the WhatsApp bot's checkout
// conversation (lib/whatsapp/checkout.ts). Fetching quotes — per vendor, merging quotes
// across every enabled logistics provider (lib/logistics/engine.ts) — must stay identical
// between the two callers, exactly like lib/order-creation.ts's buildOrder().
import connectToDatabase from '@/lib/mongodb'
import { Product } from '@/lib/models/Product'
import { Store } from '@/lib/models/Store'
import { DEFAULT_WEIGHT_KG, TEST_STORE_VENDOR_ID } from '@/lib/shipbubble'
import { getMergedQuotesForVendor } from '@/lib/logistics/engine'
import type { CourierQuote } from '@/lib/logistics/types'

// Synthetic zero-cost "courier" for the test store — never comes from a real provider
// call, so its quoteRef needs no real meaning. buildOrder only checks provider/quoteRef
// for presence, not that they resolve to a real booking (see order-creation.ts and
// order-dispatch.ts's TEST_STORE_VENDOR_ID short-circuits).
const TEST_STORE_COURIER: CourierQuote = {
  provider: 'shipbubble',
  quoteRef: 'test-store-no-real-provider',
  serviceLabel: 'Free Delivery (Test Store)',
  total: 0,
  currency: 'NGN',
  etaHours: null,
  etaLabel: 'No real courier — test store',
}

// Next business-ish day in Lagos time — Shipbubble wants pickup_date as yyyy-mm-dd.
// Same day is usually too tight for a vendor to have a package ready for pickup.
function nextPickupDate(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

export type DeliveryQuoteCustomerAddress = {
  name: string
  email: string
  phone: string
  address: string
  city: string
  state: string
}

export type DeliveryQuoteItem = {
  vendorId: string
  productId: string
  quantity: number
  price?: number
}

export type VendorDeliveryQuote = {
  vendorId: string
  storeName: string
  couriers: CourierQuote[]
  cheapestCourier: CourierQuote | null
  fastestCourier: CourierQuote | null
  error: string | null
}

export type DeliveryQuotesResult =
  | { success: true; vendors: VendorDeliveryQuote[] }
  | { success: false; error: string; status: number }

export async function getDeliveryQuotesForCart(params: {
  customerAddress: DeliveryQuoteCustomerAddress
  items: DeliveryQuoteItem[]
}): Promise<DeliveryQuotesResult> {
  const { customerAddress, items } = params

  const address = String(customerAddress?.address || '').trim()
  const city = String(customerAddress?.city || '').trim()
  const state = String(customerAddress?.state || '').trim()
  const name = String(customerAddress?.name || 'Customer').trim()
  const email = String(customerAddress?.email || '').trim()
  const phone = String(customerAddress?.phone || '').trim()

  if (!address || !city || !state || !phone) {
    return { success: false, error: 'A complete delivery address and phone number are required', status: 400 }
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { success: false, error: 'No items to quote', status: 400 }
  }

  await connectToDatabase()

  const vendorIds = Array.from(new Set(items.map((i) => String(i?.vendorId || '')).filter(Boolean)))
  const productIds = Array.from(new Set(items.map((i) => String(i?.productId || '')).filter(Boolean)))

  const [stores, products] = await Promise.all([
    Store.find({ vendorId: { $in: vendorIds } }).lean(),
    Product.find({ _id: { $in: productIds } }).select('name title price category weightKg vendorId').lean(),
  ])

  const storeByVendorId = new Map((stores as any[]).map((s) => [String(s.vendorId), s]))
  const productById = new Map((products as any[]).map((p) => [String(p._id), p]))

  const pickupDate = nextPickupDate()

  const vendorResults: VendorDeliveryQuote[] = await Promise.all(
    vendorIds.map(async (vendorId): Promise<VendorDeliveryQuote> => {
      const store: any = storeByVendorId.get(vendorId)

      if (vendorId === TEST_STORE_VENDOR_ID) {
        // Free delivery, no real provider call at all. Applies to whoever is buying, not
        // just a specific test customer.
        return {
          vendorId,
          storeName: store?.storeName || 'Test Store',
          couriers: [TEST_STORE_COURIER],
          cheapestCourier: TEST_STORE_COURIER,
          fastestCourier: TEST_STORE_COURIER,
          error: null,
        }
      }

      if (!store) {
        return { vendorId, storeName: 'Store', couriers: [], cheapestCourier: null, fastestCourier: null, error: 'Store not found' }
      }

      const vendorItems = items.filter((i) => String(i?.vendorId || '') === vendorId)
      const packageItems = vendorItems.map((item) => {
        const product: any = productById.get(String(item?.productId || ''))
        const quantity = Math.max(1, Number(item?.quantity || 1))
        const unitWeight = Number(product?.weightKg) > 0 ? Number(product.weightKg) : DEFAULT_WEIGHT_KG
        return {
          name: String(product?.name || product?.title || 'Item').slice(0, 100),
          unitWeightKg: unitWeight,
          unitAmount: Number(product?.price || item?.price || 0),
          quantity,
        }
      })

      const firstProduct: any = productById.get(String(vendorItems[0]?.productId || ''))

      const merged = await getMergedQuotesForVendor({
        store: {
          _id: String(store._id),
          storeName: store.storeName,
          address: String(store.address || ''),
          city: String(store.city || ''),
          state: String(store.state || ''),
          phone: String(store.phone || ''),
          email: String(store.email || ''),
          vendorId: String(store.vendorId || vendorId),
        },
        receiver: {
          // Sanitized elsewhere per-provider as needed — a single-word name (very likely
          // for a WhatsApp buyer, who has one free-text name field rather than separate
          // first/last name fields) trips Shipbubble's validator otherwise.
          name,
          email: email || 'customer@makeitsell.ng',
          phone,
          address,
          city,
          state,
        },
        packageItems,
        productCategory: String(firstProduct?.category || ''),
        pickupDate,
      })

      if (merged.couriers.length === 0) {
        return {
          vendorId,
          storeName: store.storeName || 'Store',
          couriers: [],
          cheapestCourier: null,
          fastestCourier: null,
          error: 'No delivery couriers are currently available for this route',
        }
      }

      return {
        vendorId,
        storeName: store.storeName || 'Store',
        couriers: merged.couriers,
        cheapestCourier: merged.cheapest,
        fastestCourier: merged.fastest,
        error: null,
      }
    })
  )

  return { success: true, vendors: vendorResults }
}
