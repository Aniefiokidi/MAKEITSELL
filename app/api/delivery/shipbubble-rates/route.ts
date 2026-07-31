import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { Product } from '@/lib/models/Product'
import { Store } from '@/lib/models/Store'
import {
  validateShipbubbleAddress,
  getOrCreateStoreAddressCode,
  fetchShipbubbleRates,
  mapProductCategoryToShipbubbleCategoryId,
  DEFAULT_WEIGHT_KG,
  TEST_STORE_VENDOR_ID,
  type ShipbubblePackageItem,
  type ShipbubbleCourierOption,
} from '@/lib/shipbubble'

// Synthetic zero-cost "courier" for the test store — never comes from a real Shipbubble
// call, so it needs no real courier_id/service_code. initialize/route.ts only checks
// these for presence, not that they're real Shipbubble values.
const TEST_STORE_COURIER: ShipbubbleCourierOption = {
  courier_id: 'test-store-free-delivery',
  courier_name: 'Free Delivery (Test Store)',
  service_code: 'test-store-free',
  service_type: 'standard',
  is_cod_available: false,
  delivery_eta: 'No real courier — test store',
  total: 0,
  currency: 'NGN',
}
const TEST_STORE_REQUEST_TOKEN = 'test-store-no-shipbubble'

// Next business-ish day in Lagos time — Shipbubble wants pickup_date as yyyy-mm-dd.
// Same day is usually too tight for a vendor to have a package ready for pickup.
function nextPickupDate(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const customerAddress = body?.customerAddress || {}
    const items: any[] = Array.isArray(body?.items) ? body.items : []

    const address = String(customerAddress?.address || '').trim()
    const city = String(customerAddress?.city || '').trim()
    const state = String(customerAddress?.state || '').trim()
    const name = String(customerAddress?.name || 'Customer').trim()
    const email = String(customerAddress?.email || '').trim()
    const phone = String(customerAddress?.phone || '').trim()

    if (!address || !city || !state || !phone) {
      return NextResponse.json({ success: false, error: 'A complete delivery address and phone number are required' }, { status: 400 })
    }
    if (items.length === 0) {
      return NextResponse.json({ success: false, error: 'No items to quote' }, { status: 400 })
    }

    await connectToDatabase()

    // Group items by vendor — each vendor ships separately from their own pickup address
    const vendorIds = Array.from(new Set(items.map((i) => String(i?.vendorId || '')).filter(Boolean)))
    const productIds = Array.from(new Set(items.map((i) => String(i?.productId || '')).filter(Boolean)))

    // The receiver-address validation below is itself a real Shipbubble API call. Skip it
    // too when every vendor in this request is the test store — no real vendor needs it.
    // A mixed cart (test store + a real vendor) still validates it, since the real vendor
    // needs a genuine receiverAddressCode.
    const hasNonTestVendors = vendorIds.some((id) => id !== TEST_STORE_VENDOR_ID)

    let receiverValidation: { addressCode: number; formattedAddress: string } | null = null
    if (hasNonTestVendors) {
      const fullAddress = [address, city, state, 'Nigeria'].filter(Boolean).join(', ')
      receiverValidation = await validateShipbubbleAddress({
        name,
        email: email || 'customer@makeitsell.ng',
        phone,
        address: fullAddress,
      })

      if (!receiverValidation) {
        return NextResponse.json({
          success: false,
          error: 'Could not validate this delivery address. Please check it and try again.',
        }, { status: 422 })
      }
    }

    const [stores, products] = await Promise.all([
      Store.find({ vendorId: { $in: vendorIds } }).lean(),
      Product.find({ _id: { $in: productIds } }).select('name title price category weightKg vendorId').lean(),
    ])

    const storeByVendorId = new Map((stores as any[]).map((s) => [String(s.vendorId), s]))
    const productById = new Map((products as any[]).map((p) => [String(p._id), p]))

    const pickupDate = nextPickupDate()

    const vendorResults = await Promise.all(
      vendorIds.map(async (vendorId) => {
        const store: any = storeByVendorId.get(vendorId)

        if (vendorId === TEST_STORE_VENDOR_ID) {
          // Free delivery, no real Shipbubble call at all — no address validation, no
          // rate-fetch. Applies to whoever is buying, not just a specific test customer.
          return {
            vendorId,
            storeName: store?.storeName || 'Test Store',
            couriers: [TEST_STORE_COURIER],
            cheapestCourier: TEST_STORE_COURIER,
            fastestCourier: TEST_STORE_COURIER,
            requestToken: TEST_STORE_REQUEST_TOKEN,
            error: null,
          }
        }

        if (!store) {
          return { vendorId, storeName: 'Store', couriers: [], requestToken: null, error: 'Store not found' }
        }

        if (!receiverValidation) {
          // Unreachable in practice — hasNonTestVendors guarantees this was validated
          // before we get here for any non-test vendor. Defensive only.
          return { vendorId, storeName: store.storeName || 'Store', couriers: [], requestToken: null, error: 'Could not validate delivery address' }
        }

        const senderAddressCode = await getOrCreateStoreAddressCode(String(store._id))
        if (!senderAddressCode) {
          return {
            vendorId,
            storeName: store.storeName || 'Store',
            couriers: [],
            requestToken: null,
            error: 'This vendor\'s pickup address is not set up for delivery yet',
          }
        }

        const vendorItems = items.filter((i) => String(i?.vendorId || '') === vendorId)
        const packageItems: ShipbubblePackageItem[] = vendorItems.map((item) => {
          const product: any = productById.get(String(item?.productId || ''))
          const quantity = Math.max(1, Number(item?.quantity || 1))
          const unitWeight = Number(product?.weightKg) > 0 ? Number(product.weightKg) : DEFAULT_WEIGHT_KG
          return {
            name: String(product?.name || product?.title || item?.title || 'Item').slice(0, 100),
            description: String(product?.name || product?.title || 'Item').slice(0, 100),
            unit_weight: String(unitWeight),
            unit_amount: String(Number(product?.price || item?.price || 0)),
            quantity: String(quantity),
          }
        })

        const firstProduct: any = productById.get(String(vendorItems[0]?.productId || ''))
        const categoryId = await mapProductCategoryToShipbubbleCategoryId(String(firstProduct?.category || ''))

        if (!categoryId) {
          return {
            vendorId,
            storeName: store.storeName || 'Store',
            couriers: [],
            requestToken: null,
            error: 'Delivery is temporarily unavailable — no shipping categories configured',
          }
        }

        const rates = await fetchShipbubbleRates({
          senderAddressCode,
          receiverAddressCode: receiverValidation.addressCode,
          pickupDate,
          categoryId,
          packageItems,
        })

        if (!rates || rates.couriers.length === 0) {
          return {
            vendorId,
            storeName: store.storeName || 'Store',
            couriers: [],
            requestToken: null,
            error: 'No delivery couriers are currently available for this route',
          }
        }

        return {
          vendorId,
          storeName: store.storeName || 'Store',
          couriers: rates.couriers,
          cheapestCourier: rates.cheapestCourier,
          fastestCourier: rates.fastestCourier,
          requestToken: rates.requestToken,
          error: null,
        }
      })
    )

    return NextResponse.json({ success: true, vendors: vendorResults })
  } catch (error: any) {
    console.error('[shipbubble-rates] Failed:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch delivery rates' }, { status: 500 })
  }
}
