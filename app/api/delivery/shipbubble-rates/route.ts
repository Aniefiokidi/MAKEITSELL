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
  type ShipbubblePackageItem,
} from '@/lib/shipbubble'

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

    const fullAddress = [address, city, state, 'Nigeria'].filter(Boolean).join(', ')
    const receiverValidation = await validateShipbubbleAddress({
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

    // Group items by vendor — each vendor ships separately from their own pickup address
    const vendorIds = Array.from(new Set(items.map((i) => String(i?.vendorId || '')).filter(Boolean)))
    const productIds = Array.from(new Set(items.map((i) => String(i?.productId || '')).filter(Boolean)))

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
        if (!store) {
          return { vendorId, storeName: 'Store', couriers: [], requestToken: null, error: 'Store not found' }
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
