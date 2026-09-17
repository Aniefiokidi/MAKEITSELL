// Services on WhatsApp are contact-only, matching the web (lib/models/ServiceContact.ts —
// "services aren't monetized right now"). The bot's whole job is: work out where the
// buyer is, find the providers closest to them, and send each provider's contact details
// with an estimated rate. No in-chat booking, negotiation or quoting.
import connectToDatabase from '@/lib/mongodb'
import { getServices, ServiceModel } from '@/lib/mongodb-operations'
import { Store } from '@/lib/models/Store'
import { WhatsAppServiceMessageMap } from '@/lib/models/WhatsAppServiceMessageMap'
import { findPlaceInText, formatDistance, getCityCoords, haversineKm, type LocatedPlace } from '@/lib/geo-utils'
import { applyLocationPricing } from '@/lib/service-pricing'
import { editDistance } from '@/lib/whatsapp/catalog-search'
import { sendTextMessage, sendImageMessage } from '@/lib/whatsapp/client'
import { WhatsAppBrowseState } from '@/lib/models/WhatsAppBrowseState'
import type { RecentResult } from '@/lib/whatsapp/recent-results'

export interface BuyerLocation {
  label: string
  lat: number
  lng: number
  city?: string
  state?: string
  // Buyer declined to say where they are ("skip"): list providers without distances and
  // don't remember this as their location.
  unknown?: boolean
}

export const UNKNOWN_LOCATION: BuyerLocation = { label: 'anywhere', lat: 0, lng: 0, unknown: true }

export interface ProviderMatch {
  service: any
  storeName: string
  phone: string        // digits only, international (234...)
  displayPhone: string // +234 801 234 5678
  areaLabel: string    // "Ikeja, Lagos"
  distanceKm: number | null
  // Provider's listed city is the buyer's own area ("Yaba" for a buyer in Yaba) — beats
  // a same-distance provider elsewhere in the same metro (city-centre coordinates can't
  // tell Yaba from Lekki).
  sameArea: boolean
  estimate: { amount: number; unit: string; from: boolean; adjusted: boolean }
}

export const PROVIDERS_PER_PAGE = 3
// Wide fetch so the distance sort has something to choose from — getServices ranks by
// text relevance, not proximity.
const CANDIDATE_LIMIT = 40

const LOCATION_PROMPT =
  'Where are you? Send your area or city (e.g. "Ikeja, Lagos"), or share your location pin, and I\'ll find the closest providers.'

export function locationPrompt(): string {
  return LOCATION_PROMPT
}

export function placeToLocation(place: LocatedPlace): BuyerLocation {
  return { label: place.name === place.state ? place.state : `${place.name}, ${place.state}`, lat: place.lat, lng: place.lng, city: place.name, state: place.state }
}

// Parses a bare location reply ("Ikeja", "I'm in Abuja", "wuse 2 abuja").
export function parseBuyerLocation(text: string): BuyerLocation | null {
  const place = findPlaceInText(text)
  return place ? placeToLocation(place) : null
}

// Pulls a trailing "in/at/around/near <place>" off a service request so "hair braiding in
// Abuja" searches for braiding and places the buyer in Abuja. A place mentioned without a
// preposition ("plumber lagos") is picked up too — but only if removing it still leaves a
// query, so a bare "Lagos" is treated as a location reply, not a search for "Lagos".
export function splitServiceQueryAndLocation(text: string): { query: string; location: BuyerLocation | null } {
  const trimmed = String(text || '').trim()
  const prepositional = trimmed.match(/^(.*?)\s+(?:in|at|around|near|within|for|here in)\s+([a-z][\w\s,-]{1,40})$/i)
  if (prepositional) {
    const place = findPlaceInText(prepositional[2])
    if (place && prepositional[1].trim()) return { query: prepositional[1].trim(), location: placeToLocation(place) }
  }
  const place = findPlaceInText(trimmed)
  if (place) {
    const escaped = place.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const without = trimmed
      .replace(new RegExp(`\\b${escaped}\\b(?:\\s*,?\\s*${place.state}\\b)?`, 'i'), ' ')
      .replace(/\b(?:state|area)\b/i, ' ')
      .replace(/\s+/g, ' ')
      .replace(/[\s,]+$/, '')
      .trim()
    if (without && without.length >= 3 && without.toLowerCase() !== trimmed.toLowerCase()) {
      return { query: without, location: placeToLocation(place) }
    }
  }
  return { query: trimmed, location: null }
}

export function normalizePhoneDigits(raw: string): string {
  let digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('0') && digits.length === 11) digits = `234${digits.slice(1)}`
  else if (digits.length === 10 && !digits.startsWith('234')) digits = `234${digits}`
  return digits
}

export function formatDisplayPhone(digits: string): string {
  if (digits.startsWith('234') && digits.length === 13) {
    return `+234 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`
  }
  return `+${digits}`
}

function formatNaira(amount: number): string {
  return `NGN ${Math.max(0, Math.round(Number(amount) || 0)).toLocaleString('en-NG')}`
}

function rateUnit(pricingType: string): string {
  const type = String(pricingType || '').toLowerCase()
  if (type === 'hourly' || type === 'per-hour' || type === 'per_hour') return 'per hour'
  if (type === 'per-session' || type === 'per_session' || type === 'session') return 'per session'
  if (type === 'daily' || type === 'per-day' || type === 'per_day') return 'per day'
  if (type === 'per-night' || type === 'per_night' || type === 'nightly') return 'per night'
  return ''
}

async function estimateRate(service: any, location: BuyerLocation | null, distanceKm: number | null): Promise<ProviderMatch['estimate']> {
  const packages = (Array.isArray(service?.packageOptions) ? service.packageOptions : []).filter((p: any) => p?.active !== false)
  const basePrice = Math.max(0, Number(service?.price) || 0)
  const unit = rateUnit(service?.pricingType)
  const from = Boolean(service?.requiresQuote) || packages.length > 1 || String(service?.pricingType || '').toLowerCase() === 'custom'

  let amount = basePrice
  let adjusted = false
  if (location && !location.unknown) {
    try {
      const priced = await applyLocationPricing({
        basePrice,
        customerLocation: location.label,
        locationPricingRules: Array.isArray(service?.locationPricingRules) ? service.locationPricingRules : [],
        distanceRatePerMile: Number(service?.distanceRatePerMile || 0),
        // Feeding the haversine distance keeps applyLocationPricing off its Mapbox path.
        tripDistanceMiles: distanceKm != null ? distanceKm * 0.621371 : 0,
      })
      if (Number.isFinite(priced.total) && priced.total !== basePrice) {
        amount = priced.total
        adjusted = true
      }
    } catch (error) {
      console.error('[whatsapp-service-contacts] location pricing failed, using base price:', error)
    }
  }
  return { amount, unit, from, adjusted }
}

export function formatEstimate(estimate: ProviderMatch['estimate']): string {
  const parts = [estimate.from ? `from ${formatNaira(estimate.amount)}` : formatNaira(estimate.amount)]
  if (estimate.unit) parts.push(estimate.unit)
  return parts.join(' ')
}

// Words that carry no information about WHICH service is wanted.
const SERVICE_STOPWORDS = new Set([
  'a', 'an', 'the', 'i', 'me', 'my', 'we', 'need', 'want', 'looking', 'look', 'for', 'someone', 'somebody', 'who', 'can', 'to', 'do',
  'good', 'best', 'cheap', 'affordable', 'reliable', 'professional', 'service', 'services', 'provider', 'providers', 'person', 'people',
  'near', 'nearby', 'around', 'close', 'closest', 'nearest', 'in', 'at', 'here', 'please', 'abeg', 'pls', 'urgent', 'urgently', 'today',
  'get', 'find', 'help', 'with', 'and', 'or', 'of', 'is', 'are', 'any', 'some', 'available', 'hire', 'book', 'booking', 'contact',
])

// Reduces "braider"/"braiders"/"braiding"/"braids" to "braid", "cleaners" to "clean",
// "photographers" to "photograph" — so a request phrased around the PERSON still matches
// a listing phrased around the WORK. Mongo's text stemmer doesn't connect those forms.
export function serviceWordRoots(query: string): string[] {
  const words = String(query || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
  const roots = new Set<string>()
  for (const word of words) {
    if (SERVICE_STOPWORDS.has(word) || word.length < 3) continue
    let root = word
    for (const suffix of ['ists', 'ist', 'ers', 'er', 'ing', 'ies', 'es', 's']) {
      if (root.length - suffix.length >= 3 && root.endsWith(suffix)) {
        root = root.slice(0, -suffix.length)
        if (suffix === 'ies') root += 'y'
        break
      }
    }
    roots.add(root)
  }
  return Array.from(roots)
}

// What we call the search back to the buyer: "plumber", not "who can fix my generator?".
export function serviceLabel(query: string): string {
  const words = String(query || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean)
  const kept = words.filter((w) => !SERVICE_STOPWORDS.has(w) && !/^(?:my|your|our|his|her|their|it|its|this|that|who|what|which|someone|somebody|fix|repair)$/.test(w))
  const label = (kept.length > 0 ? kept : words).join(' ').trim()
  return label || String(query || '').trim()
}

// Text-index search first (relevance-ranked), topped up with a root-prefix regex pass so
// "hair braider" also finds "Knotless Braids". Only active services, de-duplicated.
export async function searchServiceCandidates(query: string, limit: number): Promise<any[]> {
  await connectToDatabase()
  const trimmed = String(query || '').trim()
  const seen = new Map<string, any>()
  const add = (service: any) => {
    const id = String(service?.id || service?._id || '')
    if (id && !seen.has(id)) seen.set(id, service)
  }

  if (trimmed) {
    for (const service of await getServices({ search: trimmed, status: 'active', limitCount: limit })) add(service)
  }

  const roots = serviceWordRoots(trimmed)
  if (roots.length > 0 && seen.size < limit) {
    const escaped = roots.map((r) => r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const anyRoot = new RegExp(`\\b(?:${escaped.join('|')})`, 'i')
    const extra = await ServiceModel.find({
      status: 'active',
      $or: [{ title: anyRoot }, { description: anyRoot }, { category: anyRoot }, { subcategory: anyRoot }, { tags: anyRoot }, { providerName: anyRoot }],
    }).limit(limit).lean()
    // Prefer listings that match more of the roots — "hair braid" beats "hair studio".
    const scored = (extra as any[]).map((service) => {
      const haystack = [service.title, service.description, service.category, service.subcategory, ...(Array.isArray(service.tags) ? service.tags : [])].join(' ').toLowerCase()
      const score = roots.filter((root) => haystack.includes(root)).length
      return { service, score }
    }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score)
    for (const entry of scored) add({ ...entry.service, id: String(entry.service._id) })
  }

  // Typo tier ("plumbr", "fotographer"): compare each root against the words of every
  // active service's title/category/tags, allowing one edit (two for long words).
  if (roots.length > 0 && seen.size === 0) {
    const pool: any[] = await ServiceModel.find({ status: 'active' }).select('title category subcategory tags').limit(2000).lean()
    const scored: Array<{ service: any; score: number }> = []
    for (const service of pool) {
      const tokens = [service.title, service.category, service.subcategory, ...(Array.isArray(service.tags) ? service.tags : [])]
        .join(' ').toLowerCase().split(/[^a-z0-9]+/).filter((t: string) => t.length >= 3)
      let score = 0
      for (const root of roots) {
        const max = root.length >= 8 ? 2 : root.length >= 4 ? 1 : 0
        if (max === 0) continue
        const near = tokens.some((token: string) => {
          const tokenRoot = serviceWordRoots(token)[0] || token
          return (Math.abs(tokenRoot.length - root.length) <= max && editDistance(root, tokenRoot) <= max)
            || (Math.abs(token.length - root.length) <= max && editDistance(root, token) <= max)
        })
        if (near) score++
      }
      if (score > 0) scored.push({ service, score })
    }
    scored.sort((a, b) => b.score - a.score)
    const ids = scored.slice(0, limit).map((entry) => entry.service._id)
    if (ids.length > 0) {
      const full: any[] = await ServiceModel.find({ _id: { $in: ids } }).lean()
      const byId = new Map(full.map((doc) => [String(doc._id), doc]))
      for (const id of ids) {
        const doc = byId.get(String(id))
        if (doc) add({ ...doc, id: String(doc._id) })
      }
    }
  }
  return Array.from(seen.values()).slice(0, limit)
}

// Finds active services matching the query/category, joins each to its store for the
// public contact number (Store.phone — same source as the web's "Book via WhatsApp"
// button), drops providers with no number (a card with no way to reach them is a dead
// end), and sorts by distance from the buyer. Providers we can't place go last.
export async function findNearbyProviders(
  target: { query?: string; category?: string },
  location: BuyerLocation | null
): Promise<ProviderMatch[]> {
  await connectToDatabase()
  const services = target.category
    ? await getServices({ category: target.category, status: 'active', limitCount: CANDIDATE_LIMIT })
    : await searchServiceCandidates(String(target.query || ''), CANDIDATE_LIMIT)
  if (services.length === 0) return []

  const providerIds = Array.from(new Set(services.map((s: any) => String(s?.providerId || '')).filter(Boolean)))
  const stores: any[] = await Store.find({ vendorId: { $in: providerIds } }).select('storeName vendorId phone city state').lean()
  const storeByVendor = new Map<string, any>()
  const storeById = new Map<string, any>()
  for (const store of stores) {
    storeById.set(String(store._id), store)
    if (!storeByVendor.has(String(store.vendorId))) storeByVendor.set(String(store.vendorId), store)
  }

  const matches: ProviderMatch[] = []
  for (const service of services as any[]) {
    const store = (service.storeId && storeById.get(String(service.storeId))) || storeByVendor.get(String(service.providerId || ''))
    const phone = normalizePhoneDigits(store?.phone)
    if (!phone) continue

    const city = String(service.city || store?.city || '').trim()
    const state = String(service.state || store?.state || '').trim()
    const coords = getCityCoords(city, state)
    const distanceKm = location && !location.unknown && coords ? haversineKm(location.lat, location.lng, coords.lat, coords.lng) : null
    const areaLabel = [city, state].filter(Boolean).join(', ') || String(service.location || '').trim() || 'Location not listed'

    const buyerCity = String(location?.city || '').toLowerCase()
    const sameArea = Boolean(buyerCity && city && (city.toLowerCase() === buyerCity || areaLabel.toLowerCase().includes(buyerCity)))
    matches.push({
      service,
      storeName: String(store?.storeName || service.providerName || 'Provider'),
      phone,
      displayPhone: formatDisplayPhone(phone),
      areaLabel,
      distanceKm,
      sameArea,
      estimate: await estimateRate(service, location, distanceKm),
    })
  }

  matches.sort((a, b) => {
    if (a.sameArea !== b.sameArea) return a.sameArea ? -1 : 1
    if (a.distanceKm == null && b.distanceKm == null) return 0
    if (a.distanceKm == null) return 1
    if (b.distanceKm == null) return -1
    return a.distanceKm - b.distanceKm
  })
  return matches
}

export function buildProviderCard(match: ProviderMatch, index?: number): string {
  const title = `${index ? `${index}. ` : ''}${String(match.service?.title || 'Service')}`
  // Provider positions are city-centre estimates (lib/geo-utils.ts NIGERIA_CITIES), so a
  // small number is "same area", not a precise "0 m away".
  const where = match.distanceKm == null
    ? match.areaLabel
    : match.distanceKm < 3
      ? `${match.areaLabel} (nearby)`
      : `${match.areaLabel} (about ${formatDistance(match.distanceKm)})`
  const lines = [
    title,
    `${match.storeName} · ${where}`,
    `Estimated rate: ${formatEstimate(match.estimate)}${match.estimate.adjusted ? ' for your area' : ''}`,
    '',
    `Contact: ${match.displayPhone}`,
    `WhatsApp: https://wa.me/${match.phone}?text=${encodeURIComponent(`Hi, I found your "${String(match.service?.title || 'Service')}" service on Make It Sell. Are you available?`)}`,
    '',
    'Message them directly to agree on details, timing and the final price.',
  ]
  return lines.join('\n')
}

function buildWhatsAppImageUrl(url: string): string {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url
  return url.replace('/upload/', '/upload/w_800,q_auto,f_auto/')
}

// Sends one card per provider, tracked in WhatsAppServiceMessageMap so a reply to the
// card ("book", "contact", anything) can re-send that provider's details.
export async function sendProviderCards(waId: string, matches: ProviderMatch[], options: { startIndex?: number } = {}): Promise<void> {
  await connectToDatabase()
  const sent: RecentResult[] = []
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const index = (options.startIndex || 0) + i + 1
    const caption = buildProviderCard(match, index)
    const image = Array.isArray(match.service?.images) ? match.service.images[0] : undefined
    let result: any = null
    try {
      result = image ? await sendImageMessage(waId, buildWhatsAppImageUrl(image), caption) : await sendTextMessage(waId, caption)
    } catch (error) {
      console.error(`[whatsapp-service-contacts] send failed for ${waId}:`, error)
      if (image) result = await sendTextMessage(waId, caption).catch(() => null)
    }
    const messageId = String(result?.messages?.[0]?.id || '').trim()
    const serviceId = String(match.service?.id || match.service?._id || '')
    if (messageId && serviceId) {
      await WhatsAppServiceMessageMap.create({ messageId, serviceId, waId }).catch((error: unknown) =>
        console.error(`[whatsapp-service-contacts] failed to track card for ${waId}:`, error)
      )
    }
    if (serviceId) sent.push({ id: serviceId, kind: 'service', messageId, name: `${String(match.service?.title || 'Service')} — ${match.storeName}`, price: match.estimate.amount })
  }
  // Same memory the product cards use, so "1" / "the first one" / "send me their
  // number" resolve to a provider (lib/whatsapp/recent-results.ts).
  const previous: RecentResult[] = options.startIndex
    ? (((await WhatsAppBrowseState.findOne({ waId }).select('lastResults').lean()) as any)?.lastResults || []).filter((r: RecentResult) => r.kind === 'service')
    : []
  await WhatsAppBrowseState.findOneAndUpdate(
    { waId },
    { $set: { lastResults: [...previous, ...sent].slice(-12), lastResultsAt: new Date(), updatedAt: new Date() } },
    { upsert: true }
  ).catch((error: unknown) => console.error(`[whatsapp-service-contacts] failed to remember cards for ${waId}:`, error))
}

// A reply to a provider card: resend that provider's contact details rather than start any
// booking flow. Returns false when the quoted message wasn't one of our service cards.
export async function tryHandleProviderCardReply(waId: string, contextMessageId: string, location: BuyerLocation | null): Promise<boolean> {
  await connectToDatabase()
  const mapping: any = await WhatsAppServiceMessageMap.findOne({ messageId: contextMessageId, waId }).lean()
  if (!mapping?.serviceId) return false
  await resendProviderDetails(waId, String(mapping.serviceId), location)
  return true
}

export async function resendProviderDetails(waId: string, serviceId: string, location: BuyerLocation | null): Promise<void> {
  await connectToDatabase()
  const { getServiceById } = await import('@/lib/mongodb-operations')
  const service: any = await getServiceById(serviceId)
  if (!service) {
    await sendTextMessage(waId, "That service isn't listed any more. Tell me what you need and I'll find another provider near you.")
    return
  }
  const store: any = await Store.findOne(service.storeId ? { _id: service.storeId } : { vendorId: String(service.providerId || '') })
    .select('storeName vendorId phone city state').lean()
  const phone = normalizePhoneDigits(store?.phone)
  if (!phone) {
    await sendTextMessage(waId, `${String(store?.storeName || service.providerName || 'This provider')} hasn't added a contact number yet. Tell me what you need and I'll find another provider near you.`)
    return
  }
  const city = String(service.city || store?.city || '').trim()
  const state = String(service.state || store?.state || '').trim()
  const coords = getCityCoords(city, state)
  const distanceKm = location && !location.unknown && coords ? haversineKm(location.lat, location.lng, coords.lat, coords.lng) : null
  const match: ProviderMatch = {
    service,
    storeName: String(store?.storeName || service.providerName || 'Provider'),
    phone,
    displayPhone: formatDisplayPhone(phone),
    areaLabel: [city, state].filter(Boolean).join(', ') || 'Location not listed',
    distanceKm,
    sameArea: false,
    estimate: await estimateRate(service, location, distanceKm),
  }
  await sendTextMessage(waId, `Here are the details again — reach out to them directly on WhatsApp:\n\n${buildProviderCard(match)}`)
}
