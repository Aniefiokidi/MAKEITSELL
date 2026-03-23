import { NextRequest, NextResponse } from 'next/server'

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

async function fetchNominatimFallback(input: string) {
  const params = new URLSearchParams({
    q: `${input}, Nigeria`,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '10',
    countrycodes: 'ng',
    dedupe: '1',
  })

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'MakeItSell/1.0 (support@makeitsell.org)',
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const input = (searchParams.get('input') || '').trim()
    const region = (searchParams.get('region') || 'ng').trim().toLowerCase() // Default to Nigeria

    if (!input || input.length < 2) {
      return NextResponse.json({ error: 'Input is required' }, { status: 400 })
    }

    const apiKey = process.env.NEXT_PUBLIC_MAPBOX_API_KEY

    if (!apiKey) {
      console.warn('Mapbox API key not configured')
      return NextResponse.json({
        predictions: [],
        error: 'API key not configured'
      })
    }

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
      const fallbackPredictions = shouldUseFallback
        ? await fetchNominatimFallback(input)
        : []

      const predictions = uniqueByDescription([...mapboxPredictions, ...fallbackPredictions]).slice(0, 12)

      return NextResponse.json({
        predictions: predictions
      })
    } else {
      console.error('Mapbox API error:', data.message)
      return NextResponse.json({ 
        predictions: [],
        error: data.message || 'Failed to fetch suggestions'
      })
    }
  } catch (error: any) {
    console.error('Error in autocomplete API:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch suggestions',
      predictions: []
    }, { status: 500 })
  }
}
