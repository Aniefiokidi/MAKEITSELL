// Shipbubble API client — replaces the flat A&CO/Orah rate matrix (lib/aco-logistics-rates.ts)
// with live rates from real couriers, and automated dispatch instead of a manual
// logistics-partner dashboard. Docs: https://docs.shipbubble.com
//
// Auth: `Authorization: Bearer <key>` (confirmed live). Response envelope is always
// {status, message, data, errors} — never trust `message` for control flow, only
// `status`/`data`/`errors` (per their own docs).
import crypto from 'crypto'
import connectToDatabase from '@/lib/mongodb'
import { Store } from '@/lib/models/Store'
import { User } from '@/lib/models/User'
import { getCachedPayload, setCachedPayload } from '@/lib/cache-store'

const BASE_URL = 'https://api.shipbubble.com/v1'

function getApiKey(): string {
  return String(process.env.SHIPBUBBLE_API_KEY || '').trim()
}

async function call<T = any>(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown } = {}
): Promise<{ ok: boolean; data: T | null; message: string; httpStatus: number }> {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.error('[shipbubble] SHIPBUBBLE_API_KEY is not configured')
    return { ok: false, data: null, message: 'Shipbubble is not configured', httpStatus: 0 }
  }

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    })

    const json = await res.json().catch(() => ({}))
    const ok = res.ok && String(json?.status || '').toLowerCase() === 'success'
    return { ok, data: ok ? (json?.data ?? null) : null, message: String(json?.message || ''), httpStatus: res.status }
  } catch (error) {
    console.error(`[shipbubble] Request failed for ${path}:`, error)
    return { ok: false, data: null, message: 'Network error contacting Shipbubble', httpStatus: 0 }
  }
}

export type ShipbubbleAddress = {
  name: string
  email: string
  phone: string
  address: string
}

export async function validateShipbubbleAddress(
  input: ShipbubbleAddress
): Promise<{ addressCode: number; formattedAddress: string } | null> {
  const result = await call<{ address_code: number; formatted_address: string }>('/shipping/address/validate', {
    method: 'POST',
    body: input,
  })
  if (!result.ok || !result.data?.address_code) return null
  return { addressCode: result.data.address_code, formattedAddress: result.data.formatted_address }
}

// Shipbubble's address validator expects a person-style "full name" (letters + a space,
// e.g. "John Doe") in the `name` field and 422s on anything else — including a single-word
// business name like "Asani", even though it has no digits or symbols. Store names are
// often one word or a brand name, so they can't be trusted to pass as-is.
function sanitizeContactName(input: string): string {
  return String(input || '').replace(/[^a-zA-Z\s]/g, '').trim().replace(/\s+/g, ' ')
}

function ensureTwoWordName(input: string, fallbackSuffix: string): string {
  const cleaned = sanitizeContactName(input)
  if (cleaned.split(' ').filter(Boolean).length >= 2) return cleaned
  return cleaned ? `${cleaned} ${fallbackSuffix}` : `Store ${fallbackSuffix}`
}

/**
 * Returns the store's pickup address_code, validating and caching it on the Store
 * document if it hasn't been validated yet (or was invalidated by an address edit —
 * see app/api/database/stores/[id]/route.ts). Avoids re-validating the same address
 * on every checkout.
 */
export async function getOrCreateStoreAddressCode(storeId: string): Promise<number | null> {
  await connectToDatabase()
  const store: any = await Store.findById(storeId).lean()
  if (!store) return null

  if (Number.isFinite(Number(store.shipbubbleAddressCode))) {
    return Number(store.shipbubbleAddressCode)
  }

  const address = String(store.address || '').trim()
  const phone = String(store.phone || '').trim()
  const email = String(store.email || '').trim()
  if (!address || !phone || !email) return null

  const vendorUser: any = store.vendorId ? await User.findOne({ _id: store.vendorId }).select('displayName').lean() : null
  const ownerName = sanitizeContactName(vendorUser?.displayName || '')
  const contactName = ownerName.split(' ').filter(Boolean).length >= 2
    ? ownerName
    : ensureTwoWordName(store.storeName || 'Vendor', 'Store')

  const validated = await validateShipbubbleAddress({
    name: contactName,
    email,
    phone,
    address,
  })
  if (!validated) return null

  await Store.updateOne(
    { _id: storeId },
    { $set: { shipbubbleAddressCode: validated.addressCode, shipbubbleAddressVerifiedAt: new Date() } }
  )

  return validated.addressCode
}

export type ShipbubblePackageItem = {
  name: string
  description: string
  unit_weight: string
  unit_amount: string
  quantity: string
}

export type ShipbubbleCourierOption = {
  courier_id: string
  courier_name: string
  courier_image?: string
  service_code: string
  service_type: string
  is_cod_available: boolean
  pickup_eta?: string
  delivery_eta?: string
  total: number
  currency: string
  ratings?: number
  tracking?: { bars: number; label: string }
}

export type ShipbubbleRatesResult = {
  requestToken: string
  couriers: ShipbubbleCourierOption[]
  cheapestCourier: ShipbubbleCourierOption | null
  fastestCourier: ShipbubbleCourierOption | null
}

// A reasonable generic default for typical retail goods — used only when a product
// has no weightKg/dimensions set, so rate-fetching never hard-fails on missing vendor
// data. Matches Shipbubble's own "Big Box" preset (confirmed live: 34x34x32cm, 12kg max).
export const DEFAULT_PACKAGE_DIMENSION = { length: 32, width: 34, height: 34 }
export const DEFAULT_WEIGHT_KG = 1

export async function fetchShipbubbleRates(params: {
  senderAddressCode: number
  receiverAddressCode: number
  pickupDate: string // yyyy-mm-dd
  categoryId: number
  packageItems: ShipbubblePackageItem[]
  packageDimension?: { length: number; width: number; height: number }
}): Promise<ShipbubbleRatesResult | null> {
  const result = await call<any>('/shipping/fetch_rates', {
    method: 'POST',
    body: {
      sender_address_code: params.senderAddressCode,
      reciever_address_code: params.receiverAddressCode,
      pickup_date: params.pickupDate,
      category_id: params.categoryId,
      package_items: params.packageItems,
      package_dimension: params.packageDimension || DEFAULT_PACKAGE_DIMENSION,
    },
  })
  if (!result.ok || !result.data?.request_token) return null

  return {
    requestToken: result.data.request_token,
    couriers: Array.isArray(result.data.couriers) ? result.data.couriers : [],
    cheapestCourier: result.data.cheapest_courier || null,
    fastestCourier: result.data.fastest_courier || null,
  }
}

export type ShipbubbleShipment = {
  orderId: string
  trackingUrl: string
  courierName: string
  status: string
}

export async function createShipbubbleShipment(params: {
  requestToken: string
  serviceCode: string
  courierId: string
}): Promise<ShipbubbleShipment | null> {
  const result = await call<any>('/shipping/labels', {
    method: 'POST',
    body: {
      request_token: params.requestToken,
      service_code: params.serviceCode,
      courier_id: params.courierId,
      is_cod_label: false, // MakeItSell always pays couriers via its own wallet/escrow, never COD
    },
  })
  if (!result.ok || !result.data?.order_id) return null

  return {
    orderId: String(result.data.order_id),
    trackingUrl: String(result.data.tracking_url || ''),
    courierName: String(result.data?.courier?.name || ''),
    status: String(result.data.status || 'pending'),
  }
}

export async function cancelShipbubbleShipment(shipbubbleOrderId: string): Promise<boolean> {
  const result = await call(`/shipping/labels/cancel/${encodeURIComponent(shipbubbleOrderId)}`, { method: 'POST' })
  return result.ok
}

export async function getShipbubbleShipment(shipbubbleOrderId: string): Promise<any | null> {
  const result = await call<any>(`/shipping/labels/list/${encodeURIComponent(shipbubbleOrderId)}`)
  if (!result.ok) return null
  const first = Array.isArray(result.data?.results) ? result.data.results[0] : null
  return first || null
}

export async function getShipbubbleWalletBalance(): Promise<{ balance: number; currency: string } | null> {
  const result = await call<{ balance: number; currency: string }>('/shipping/wallet/balance')
  if (!result.ok || !result.data) return null
  return { balance: Number(result.data.balance || 0), currency: String(result.data.currency || 'NGN') }
}

/**
 * Verifies the x-ship-signature header (HMAC-SHA512) against the raw request body — per
 * Shipbubble's webhook docs. Their dashboard's API settings page has no separate webhook
 * secret field (only the API key and the webhook URL), so the API key itself is the
 * signing key. Must be computed over the raw (unparsed) body, not the re-serialized
 * JSON, or the signature won't match.
 */
export function verifyShipbubbleWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = getApiKey()
  if (!secret || !signatureHeader) return false

  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader))
  } catch {
    return false // length mismatch etc. — not a valid signature
  }
}

// Real category IDs confirmed live against the account on 2026-07-22 via
// GET /shipping/labels/categories — these are account-scoped reference data, not
// hardcoded platform constants, so they're cached (long TTL) rather than assumed
// stable forever.
const CATEGORY_KEYWORD_MAP: Array<{ keywords: string[]; shipbubbleName: string }> = [
  { keywords: ['hot food', 'food & bev', 'restaurant', 'meal'], shipbubbleName: 'Hot food' },
  { keywords: ['grocery', 'groceries', 'supplement', 'dry food'], shipbubbleName: 'Dry food and supplements' },
  { keywords: ['electronic', 'gadget', 'phone', 'laptop'], shipbubbleName: 'Electronics and gadgets' },
  { keywords: ['grocery', 'groceries'], shipbubbleName: 'Groceries' },
  { keywords: ['document', 'atm', 'card', 'sensitive'], shipbubbleName: 'Sensitive items (ATM cards, documents)' },
  { keywords: ['machinery', 'tool', 'equipment'], shipbubbleName: 'Machinery' },
  { keywords: ['medical', 'medicine', 'pharmacy', 'health supplies'], shipbubbleName: 'Medical supplies' },
  { keywords: ['beauty', 'health', 'cosmetic', 'skincare', 'hair'], shipbubbleName: 'Health and beauty' },
  { keywords: ['furniture', 'fitting', 'home & garden', 'home'], shipbubbleName: 'Furniture and fittings' },
  { keywords: ['fashion', 'wear', 'cloth', 'apparel', 'shoe'], shipbubbleName: 'Fashion wears' },
]
const FALLBACK_CATEGORY_NAME = 'Light weight items'

async function getShipbubbleCategoryMap(): Promise<Map<string, number>> {
  const cacheKey = 'v1'
  const cached = await getCachedPayload<Record<string, number>>('shipbubble-categories', cacheKey)
  if (cached) return new Map(Object.entries(cached))

  const result = await call<Array<{ category_id: number; category: string }>>('/shipping/labels/categories')
  const list = Array.isArray(result.data) ? result.data : []
  const map = new Map<string, number>(list.map((c) => [c.category, c.category_id]))

  if (map.size > 0) {
    await setCachedPayload('shipbubble-categories', cacheKey, Object.fromEntries(map), 86400) // 24h
  }
  return map
}

export async function mapProductCategoryToShipbubbleCategoryId(productCategory: string): Promise<number | null> {
  const categoryMap = await getShipbubbleCategoryMap()
  if (categoryMap.size === 0) return null

  const haystack = String(productCategory || '').toLowerCase()
  for (const entry of CATEGORY_KEYWORD_MAP) {
    if (entry.keywords.some((kw) => haystack.includes(kw))) {
      const id = categoryMap.get(entry.shipbubbleName)
      if (id) return id
    }
  }
  return categoryMap.get(FALLBACK_CATEGORY_NAME) ?? firstMapValue(categoryMap)
}

function firstMapValue(map: Map<string, number>): number | null {
  const first = map.values().next()
  return first.done ? null : first.value
}
