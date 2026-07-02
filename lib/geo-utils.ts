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
