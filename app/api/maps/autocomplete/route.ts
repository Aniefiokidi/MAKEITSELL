import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const input = searchParams.get('input')
    const region = searchParams.get('region') || 'ng' // Default to Nigeria

    if (!input) {
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

    // Using Mapbox Geocoding API - FREE tier: 100,000 requests/month!
    // Reference: https://docs.mapbox.com/api/search/geocoding/
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(input)}.json?country=${region}&limit=8&types=address,place,locality,neighborhood&access_token=${apiKey}`
    
    const response = await fetch(url)
    
    const data = await response.json()

    if (response.ok && data.features) {
      // Transform Mapbox response to match our expected format
      const predictions = data.features.map((place: any) => {
        const address = place.properties?.address || place.place_name
        const context = place.context || []
        
        // Extract location components
        let mainText = place.text || place.place_name.split(',')[0]
        
        // Add house number if available
        if (place.address) {
          mainText = `${place.address} ${mainText}`
        }
        
        // Build secondary text from context
        const secondaryParts = []
        context.forEach((ctx: any) => {
          if (ctx.id.includes('place') || ctx.id.includes('region') || ctx.id.includes('locality')) {
            secondaryParts.push(ctx.text)
          }
        })
        
        const secondaryText = secondaryParts.join(', ') || place.place_name.split(',').slice(1).join(',').trim()

        return {
          place_id: place.id,
          description: place.place_name,
          structured_formatting: {
            main_text: mainText,
            secondary_text: secondaryText
          }
        }
      })

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
