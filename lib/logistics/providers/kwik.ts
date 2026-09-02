// LogisticsProvider adapter for Kwik (lib/kwik.ts). Unlike Shipbubble, Kwik needs raw
// lat/lng rather than a validated address string, and quotes per-vehicle rather than
// returning many ready-made courier options in one call — this adapter picks the single
// smallest vehicle that can carry the cart's total weight and prices just that one, so
// the cross-provider Standard/Express split (lib/logistics/engine.ts) still has something
// sensible to merge against Shipbubble's options without doubling Kwik's own API costs.
import connectToDatabase from '@/lib/mongodb'
import { Store } from '@/lib/models/Store'
import { mapboxService } from '@/lib/mapbox'
import {
  isKwikConfigured,
  getKwikVehicles,
  calculateKwikPricing,
  createKwikTask,
  cancelKwikTask,
  type KwikLocation,
  type KwikPricingResult,
} from '@/lib/kwik'
import type { BookingContext, CourierQuote, LogisticsProvider, LogisticsQuoteParams, ShipmentBookingResult } from '../types'

type KwikQuoteRef = { pickup: KwikLocation; delivery: KwikLocation; pricing: KwikPricingResult }

async function getOrGeocodeStorePickup(store: LogisticsQuoteParams['store']): Promise<{ lat: number; lng: number } | null> {
  await connectToDatabase()
  const stored: any = await Store.findById(store._id).select('kwikPickupLat kwikPickupLng').lean()
  if (stored && typeof stored.kwikPickupLat === 'number' && typeof stored.kwikPickupLng === 'number') {
    return { lat: stored.kwikPickupLat, lng: stored.kwikPickupLng }
  }

  const coords = await mapboxService.geocodeAddress({
    address: store.address,
    city: store.city || '',
    state: store.state || '',
    country: 'Nigeria',
  })
  if (!coords) return null

  await Store.updateOne(
    { _id: store._id },
    { $set: { kwikPickupLat: coords.latitude, kwikPickupLng: coords.longitude, kwikGeocodedAt: new Date() } }
  )
  return { lat: coords.latitude, lng: coords.longitude }
}

function pickVehicleForWeight(vehicles: Awaited<ReturnType<typeof getKwikVehicles>>, totalWeightKg: number) {
  const candidates = vehicles.filter((v) => v.weightKg >= totalWeightKg)
  if (candidates.length > 0) {
    return candidates.reduce((min, v) => (v.weightKg < min.weightKg ? v : min), candidates[0])
  }
  // Nothing documented as heavy enough — fall back to the largest available rather than
  // failing outright; Kwik's own dispatch can still reject it at booking time.
  return vehicles.length > 0 ? vehicles.reduce((max, v) => (v.weightKg > max.weightKg ? v : max), vehicles[0]) : null
}

export const kwikProvider: LogisticsProvider = {
  id: 'kwik',

  isEnabled() {
    return isKwikConfigured()
  },

  async getQuotes(params: LogisticsQuoteParams): Promise<CourierQuote[]> {
    if (!this.isEnabled()) return []

    const [pickupCoords, deliveryCoords, vehicles] = await Promise.all([
      getOrGeocodeStorePickup(params.store),
      mapboxService.geocodeAddress({
        address: params.receiver.address,
        city: params.receiver.city,
        state: params.receiver.state,
        country: 'Nigeria',
      }),
      getKwikVehicles(),
    ])
    if (!pickupCoords || !deliveryCoords || vehicles.length === 0) return []

    const totalWeightKg = params.packageItems.reduce((sum, item) => sum + item.unitWeightKg * item.quantity, 0)
    const vehicle = pickVehicleForWeight(vehicles, totalWeightKg)
    if (!vehicle) return []

    const pickup: KwikLocation = {
      address: [params.store.address, params.store.city, params.store.state, 'Nigeria'].filter(Boolean).join(', '),
      name: params.store.storeName || 'Vendor',
      latitude: pickupCoords.lat,
      longitude: pickupCoords.lng,
      phone: params.store.phone,
      email: params.store.email,
    }
    const delivery: KwikLocation = {
      address: [params.receiver.address, params.receiver.city, params.receiver.state, 'Nigeria'].filter(Boolean).join(', '),
      name: params.receiver.name,
      latitude: deliveryCoords.latitude,
      longitude: deliveryCoords.longitude,
      phone: params.receiver.phone,
      email: params.receiver.email,
    }

    const pricing = await calculateKwikPricing({ pickup, delivery, vehicleId: vehicle.vehicleId })
    if (!pricing) return []

    const quoteRef: KwikQuoteRef = { pickup, delivery, pricing }
    return [
      {
        provider: 'kwik',
        quoteRef: JSON.stringify(quoteRef),
        serviceLabel: `Kwik ${vehicle.name}`,
        total: pricing.netPayableAmount,
        currency: pricing.currency,
        // Kwik's docs expose no ETA field in the pricing response — null here means the
        // engine's "fastest" comparison never picks Kwik purely on speed until we have a
        // real number to compare with; it still competes fully on price.
        etaHours: null,
        etaLabel: '',
      },
    ]
  },

  async bookShipment(quoteRef: string, _context: BookingContext): Promise<ShipmentBookingResult | null> {
    const parsed: KwikQuoteRef = JSON.parse(quoteRef)
    const task = await createKwikTask({ pickup: parsed.pickup, delivery: parsed.delivery, vehicleId: parsed.pricing.vehicleId, pricing: parsed.pricing })
    if (!task) return null
    return {
      providerOrderId: task.jobIds,
      trackingUrl: task.trackingUrl,
      courierName: 'Kwik',
      status: 'pending',
    }
  },

  async cancelShipment(providerOrderId: string): Promise<boolean> {
    return cancelKwikTask(providerOrderId)
  },
}
