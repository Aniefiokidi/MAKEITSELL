import { NextRequest, NextResponse } from 'next/server'
import { searchNominatim } from '@/lib/nominatim'

const normalizeText = (value: unknown) => String(value || '').trim().toLowerCase()

const uniqueByDescription = (items: any[]) => {
  const seen = new Set<string>()
  const output: any[] = []

  for (const item of items) {
    const key = normalizeText(item?.description || item?.place_name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    output.push(item)
  }

  return output
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const input = (searchParams.get('input') || '').trim()
  const region = (searchParams.get('region') || 'ng').trim().toLowerCase() // Default to Nigeria

  if (!input || input.length < 2) {
    return NextResponse.json({ error: 'Input is required' }, { status: 400 })
  }

  // Nominatim (OpenStreetMap) is the free, always-available provider — it's the actual
  // fallback in every failure mode below (missing key, Mapbox error, network exception),
  // not just a supplement when Mapbox comes up short. Wrapped in its own try/catch since
  // it must never be the reason this route fails when Mapbox already has.
  const fetchFreeFallback = async (): Promise<any[]> => {
    try {
      return await searchNominatim(input)
    } catch (error) {
      console.error('[maps/autocomplete] Nominatim fallback failed:', error)
      return []
    }
  }

  const apiKey = process.env.NEXT_PUBLIC_MAPBOX_API_KEY

  if (!apiKey) {
    const predictions = await fetchFreeFallback()
    return NextResponse.json({ predictions })
  }

  try {
    // Broaden supported place types and keep strong Nigeria bias with fallback to global.
    const commonParams = new URLSearchParams({
      access_token: apiKey,
      autocomplete: 'true',
      limit: '10',
      language: 'en',
      types: 'poi,address,neighborhood,locality,place,district,postcode,region,country',
      fuzzyMatch: 'true',
    })

    if (region === 'ng') {
      // Nigeria bounding box and proximity improve ranking for local searches.
      commonParams.set('bbox', '2.67,4.24,14.68,13.89')
      commonParams.set('proximity', '7.4913,9.0820')
    }

    const buildUrl = (withCountryFilter: boolean) => {
      const params = new URLSearchParams(commonParams)
      if (withCountryFilter && region !== 'all') {
        params.set('country', region)
      }
      return `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(input)}.json?${params}`
    }

    let response = await fetch(buildUrl(true))
    let data = await response.json()

    // If strict country filtering misses locations, fallback to broader search.
    if (response.ok && (!Array.isArray(data.features) || data.features.length === 0) && region !== 'all') {
      response = await fetch(buildUrl(false))
      data = await response.json()
    }

    if (response.ok && data.features) {
      // Transform Mapbox response to a stable format for UI components.
      const mapboxPredictions = data.features.map((place: any) => {
        const context = place.context || []

        // Extract location components
        let mainText = place.text || place.place_name.split(',')[0]

        // Add house number if available
        if (place.address) {
          mainText = `${place.address} ${mainText}`
        }

        // Build secondary text from context
        const secondaryParts: string[] = []
        context.forEach((ctx: any) => {
          if (ctx.id.includes('place') || ctx.id.includes('region') || ctx.id.includes('locality')) {
            secondaryParts.push(ctx.text)
          }
        })

        const secondaryText = secondaryParts.join(', ') || place.place_name.split(',').slice(1).join(',').trim()

        return {
          id: place.id,
          text: mainText,
          place_name: place.place_name,
          center: place.center,
          context,
          place_type: place.place_type || [],
          properties: place.properties || {},
          place_id: place.id,
          description: place.place_name,
          structured_formatting: {
            main_text: mainText,
            secondary_text: secondaryText,
          },
        }
      })

      const shouldUseFallback = mapboxPredictions.length < 10
      const fallbackPredictions = shouldUseFallback ? await fetchFreeFallback() : []

      const predictions = uniqueByDescription([...mapboxPredictions, ...fallbackPredictions]).slice(0, 12)

      return NextResponse.json({
        predictions: predictions
      })
    } else {
      console.error('Mapbox API error:', data.message)
      const predictions = await fetchFreeFallback()
      return NextResponse.json({ predictions })
    }
  } catch (error: any) {
    console.error('Error in autocomplete API:', error)
    const predictions = await fetchFreeFallback()
    return NextResponse.json({ predictions })
  }
}
