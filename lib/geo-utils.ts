// Haversine distance in km between two lat/lng points
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m away`
  if (km < 10) return `${km.toFixed(1)} km away`
  return `${Math.round(km)} km away`
}

// Nigerian cities with approximate centre coordinates
// Entries can have multiple name variants for fuzzy matching
const NIGERIA_CITIES: Array<{ names: string[]; state: string; lat: number; lng: number }> = [
  { names: ["lagos", "ikeja", "lekki", "victoria island", "vi", "surulere", "yaba", "ikorodu", "badagry", "ajah", "sangotedo", "festac", "apapa"], state: "lagos", lat: 6.5244, lng: 3.3792 },
  { names: ["abuja", "fct", "garki", "wuse", "maitama", "asokoro", "gwarinpa", "kubwa", "kuje", "bwari", "nyanya", "gwagwalada"], state: "fct", lat: 9.0579, lng: 7.4951 },
  { names: ["kano", "wudil", "dala"], state: "kano", lat: 12.0022, lng: 8.5920 },
  { names: ["ibadan", "oluyole", "egbeda"], state: "oyo", lat: 7.3775, lng: 3.9470 },
  { names: ["port harcourt", "ph", "obio-akpor", "rumuola", "trans amadi", "elelenwo", "rumuodara"], state: "rivers", lat: 4.8156, lng: 7.0498 },
  { names: ["benin city", "benin", "egor", "oredo"], state: "edo", lat: 6.3350, lng: 5.6278 },
  { names: ["jos", "bukuru"], state: "plateau", lat: 9.9285, lng: 8.8916 },
  { names: ["ilorin", "kwara"], state: "kwara", lat: 8.4966, lng: 4.5426 },
  { names: ["enugu", "trans-ekulu"], state: "enugu", lat: 6.4584, lng: 7.5464 },
  { names: ["kaduna", "rigasa"], state: "kaduna", lat: 10.5272, lng: 7.4396 },
  { names: ["aba", "aba north"], state: "abia", lat: 5.1066, lng: 7.3677 },
  { names: ["onitsha", "anambra"], state: "anambra", lat: 6.1333, lng: 6.7833 },
  { names: ["warri", "uvwie"], state: "delta", lat: 5.5167, lng: 5.7500 },
  { names: ["abeokuta", "ogun"], state: "ogun", lat: 7.1475, lng: 3.3619 },
  { names: ["akure", "ondo"], state: "ondo", lat: 7.2525, lng: 5.1975 },
  { names: ["owerri", "imo"], state: "imo", lat: 5.4836, lng: 7.0333 },
  { names: ["uyo", "akwa ibom"], state: "akwa ibom", lat: 5.0527, lng: 7.9337 },
  { names: ["calabar", "cross river"], state: "cross river", lat: 4.9757, lng: 8.3417 },
  { names: ["maiduguri", "borno"], state: "borno", lat: 11.8311, lng: 13.1506 },
  { names: ["sokoto"], state: "sokoto", lat: 13.0059, lng: 5.2476 },
  { names: ["bauchi"], state: "bauchi", lat: 10.3158, lng: 9.8442 },
  { names: ["makurdi", "benue"], state: "benue", lat: 7.7322, lng: 8.5227 },
  { names: ["asaba"], state: "delta", lat: 6.1964, lng: 6.7383 },
  { names: ["yola", "adamawa"], state: "adamawa", lat: 9.2035, lng: 12.4954 },
  { names: ["zaria"], state: "kaduna", lat: 11.0699, lng: 7.7069 },
  { names: ["minna", "niger"], state: "niger", lat: 9.6139, lng: 6.5569 },
  { names: ["lokoja", "kogi"], state: "kogi", lat: 7.7978, lng: 6.7376 },
  { names: ["lafia", "nasarawa"], state: "nasarawa", lat: 8.4942, lng: 8.5203 },
  { names: ["osogbo", "oshogbo", "osun"], state: "osun", lat: 7.7719, lng: 4.5624 },
  { names: ["ado-ekiti", "ado ekiti", "ekiti"], state: "ekiti", lat: 7.6239, lng: 5.2215 },
  { names: ["gombe"], state: "gombe", lat: 10.2904, lng: 11.1673 },
  { names: ["abakaliki", "ebonyi"], state: "ebonyi", lat: 6.3249, lng: 8.1137 },
  { names: ["awka"], state: "anambra", lat: 6.2108, lng: 7.0700 },
  { names: ["katsina"], state: "katsina", lat: 12.9889, lng: 7.5994 },
  { names: ["birnin kebbi", "kebbi"], state: "kebbi", lat: 12.4539, lng: 4.1975 },
  { names: ["gusau", "zamfara"], state: "zamfara", lat: 12.1700, lng: 6.6634 },
  { names: ["dutse", "jigawa"], state: "jigawa", lat: 11.7572, lng: 9.3404 },
  { names: ["damaturu", "yobe"], state: "yobe", lat: 11.7467, lng: 11.9600 },
  { names: ["jalingo", "taraba"], state: "taraba", lat: 8.8880, lng: 11.3500 },
  { names: ["potiskum"], state: "yobe", lat: 11.7167, lng: 11.0667 },
  { names: ["sapele"], state: "delta", lat: 5.8900, lng: 5.6794 },
  { names: ["ijebu-ode", "ijebu ode"], state: "ogun", lat: 6.8188, lng: 3.9301 },
  { names: ["mushin"], state: "lagos", lat: 6.5236, lng: 3.3528 },
  { names: ["ogbomosho"], state: "oyo", lat: 8.1333, lng: 4.2500 },
  { names: ["ondo city", "ondo"], state: "ondo", lat: 7.0900, lng: 4.8300 },
  { names: ["umuahia", "abia"], state: "abia", lat: 5.5290, lng: 7.4864 },
  { names: ["oyo"], state: "oyo", lat: 7.8500, lng: 3.9333 },
  { names: ["effon-alaiye"], state: "ekiti", lat: 7.6789, lng: 4.9222 },
]

export function getCityCoords(city?: string | null, state?: string | null): { lat: number; lng: number } | null {
  const c = (city || "").toLowerCase().trim()
  const s = (state || "").toLowerCase().trim().replace(/\s+state$/i, "")

  for (const entry of NIGERIA_CITIES) {
    // Exact city name match
    if (c && entry.names.some((n) => c === n || c.includes(n) || n.includes(c))) {
      return { lat: entry.lat, lng: entry.lng }
    }
  }
  // Fall back to state-level match
  for (const entry of NIGERIA_CITIES) {
    if (s && (entry.state === s || s.includes(entry.state) || entry.state.includes(s))) {
      return { lat: entry.lat, lng: entry.lng }
    }
  }
  return null
}

// Distance from user coordinates to an item that has city/state strings
export function distanceToItem(
  userLat: number,
  userLng: number,
  item: { city?: string | null; state?: string | null }
): number | null {
  const coords = getCityCoords(item.city, item.state)
  if (!coords) return null
  return haversineKm(userLat, userLng, coords.lat, coords.lng)
}

export interface LocatedPlace {
  // The city/area name as matched (title-cased for display), its state, and the centre
  // coordinates the distance maths runs on.
  name: string
  state: string
  lat: number
  lng: number
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (c) => c.toUpperCase())
}

// Finds a Nigerian city/area or state mentioned anywhere in free text ("I'm in Ikeja",
// "hair braiding around wuse 2", "Lagos"). Longest names win so "port harcourt" beats
// "ph", and two-letter aliases ("ph", "vi") only count when they are the whole message —
// otherwise "i need a photographer" would land in Port Harcourt. Used by the WhatsApp
// services flow to place a buyer without a location pin.
export function findPlaceInText(text: string): LocatedPlace | null {
  const lower = String(text || '').toLowerCase().replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!lower) return null

  const candidates: Array<{ token: string; entry: (typeof NIGERIA_CITIES)[number]; isState: boolean }> = []
  for (const entry of NIGERIA_CITIES) {
    for (const name of entry.names) candidates.push({ token: name, entry, isState: false })
    candidates.push({ token: entry.state, entry, isState: true })
  }
  // The place mentioned first wins ("Ikeja, Lagos" -> Ikeja, the more specific one), then
  // the longer name ("port harcourt" over "ph"), then a city over a state.
  let best: { index: number; token: string; entry: (typeof NIGERIA_CITIES)[number]; isState: boolean } | null = null
  for (const { token, entry, isState } of candidates) {
    let index = -1
    if (token.length <= 2) {
      if (lower === token) index = 0
    } else {
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const match = new RegExp(`(?:^|[\\s,-])(${escaped})(?:$|[\\s,-])`).exec(lower)
      if (match) index = match.index + match[0].indexOf(match[1])
    }
    if (index < 0) continue
    if (
      !best ||
      index < best.index ||
      (index === best.index && (token.length > best.token.length || (token.length === best.token.length && !isState && best.isState)))
    ) {
      best = { index, token, entry, isState }
    }
  }
  if (!best) return null
  const { token, entry, isState } = best
  const stateLabel = entry.state === 'fct' ? 'Abuja' : titleCase(entry.state)
  const cityLabel = titleCase(token.length <= 2 ? entry.names[0] : token)
  return { name: isState ? stateLabel : cityLabel, state: stateLabel, lat: entry.lat, lng: entry.lng }
}
