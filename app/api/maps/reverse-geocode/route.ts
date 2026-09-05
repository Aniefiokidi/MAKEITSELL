import { NextRequest, NextResponse } from 'next/server'
import { reverseGeocodeNominatim } from '@/lib/nominatim'

// Public, no auth — same access level as /api/maps/autocomplete, which this mirrors.
// Only consumer today is the mobile apps' drag-to-confirm pin map (packages/ui's
// AddressMapPicker), turning a dropped pin back into a readable address.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = Number(searchParams.get('lat'))
  const lng = Number(searchParams.get('lng'))

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
  }

  try {
    const result = await reverseGeocodeNominatim(lat, lng)
    if (!result) {
      return NextResponse.json({ address: null, city: null, state: null })
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error('[maps/reverse-geocode] Failed:', error)
    return NextResponse.json({ address: null, city: null, state: null })
  }
}
