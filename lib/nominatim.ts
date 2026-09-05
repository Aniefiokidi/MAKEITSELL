// Shared OpenStreetMap/Nominatim search — the free, no-API-key geocoding provider used
// as a fallback everywhere Mapbox is unconfigured or fails. Extracted from
// app/api/maps/autocomplete/route.ts so lib/mapbox.ts's geocodeAddress() can reuse the
// exact same request/parsing logic instead of duplicating it.
export interface NominatimResult {
  id: string
  text: string
  place_name: string
  center?: [number, number]
  context: unknown[]
  place_type: string[]
  properties: { source: 'nominatim'; class?: string; type?: string }
  place_id: string
  description: string
  structured_formatting: { main_text: string; secondary_text: string }
}

export interface ReverseGeocodeResult {
  address: string
  city: string
  state: string
}

// Turns a lat/lng into a readable address — the reverse of searchNominatim, needed by
// the mobile apps' drag-to-confirm pin map (there's no equivalent forward-only Mapbox
// call site to mirror here since this is a new capability, not an existing broken one).
export async function reverseGeocodeNominatim(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'jsonv2',
    addressdetails: '1',
  })

  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'MakeItSell/1.0 (support@makeitsell.ng)',
    },
    cache: 'no-store',
  })

  if (!response.ok) return null
  const data = await response.json().catch(() => null)
  if (!data || typeof data !== 'object') return null

  const address = String(data.display_name || '').trim()
  if (!address) return null

  const details = data.address || {}
  const city = String(details.city || details.town || details.village || details.suburb || '').trim()
  const state = String(details.state || '').trim()

  return { address, city, state }
}

export async function searchNominatim(query: string, limit = 10): Promise<NominatimResult[]> {
  const params = new URLSearchParams({
    q: `${query}, Nigeria`,
    format: 'jsonv2',
    addressdetails: '1',
    limit: String(limit),
    countrycodes: 'ng',
    dedupe: '1',
  })

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'MakeItSell/1.0 (support@makeitsell.ng)',
    },
    cache: 'no-store',
  })

  if (!response.ok) return []
  const data = await response.json().catch(() => [])
  if (!Array.isArray(data)) return []

  return data.map((place: any) => {
    const description = String(place.display_name || '').trim()
    const mainText = String(place.name || description.split(',')[0] || '').trim()
    const secondaryText = description.includes(',')
      ? description.split(',').slice(1).join(',').trim()
      : 'Nigeria'

    const lon = Number(place.lon)
    const lat = Number(place.lat)

    return {
      id: `osm-${place.place_id}`,
      text: mainText,
      place_name: description,
      center: Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : undefined,
      context: [],
      place_type: [place.type || 'address'],
      properties: {
        source: 'nominatim',
        class: place.class,
        type: place.type,
      },
      place_id: `osm-${place.place_id}`,
      description,
      structured_formatting: {
        main_text: mainText,
        secondary_text: secondaryText,
      },
    }
  })
}
