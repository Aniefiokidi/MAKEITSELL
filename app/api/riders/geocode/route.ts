import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { logisticsEmailAllowedForRegion, resolveLogisticsRegion } from '@/lib/logistics-access'

export async function GET(request: NextRequest) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const region = resolveLogisticsRegion(request.nextUrl.searchParams.get('region'))
  if (!logisticsEmailAllowedForRegion(sessionUser.email, region)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const q = String(request.nextUrl.searchParams.get('q') || '').trim()
  if (!q || q.length < 3) {
    return NextResponse.json({ success: true, results: [] })
  }

  try {
    const params = new URLSearchParams({
      q: `${q}, Nigeria`,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '8',
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

    if (!response.ok) {
      return NextResponse.json({ success: true, results: [] })
    }

    const data = await response.json().catch(() => [])
    if (!Array.isArray(data)) {
      return NextResponse.json({ success: true, results: [] })
    }

    const results = data
      .map((place: any) => ({
        label: String(place.display_name || '').trim(),
        lat: Number(place.lat),
        lng: Number(place.lon),
      }))
      .filter((r: any) => r.label && Number.isFinite(r.lat) && Number.isFinite(r.lng))

    return NextResponse.json({ success: true, results })
  } catch (error) {
    console.error('[api/riders/geocode] Failed:', error)
    return NextResponse.json({ success: true, results: [] })
  }
}
