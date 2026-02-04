import { NextApiRequest, NextApiResponse } from 'next'

export interface DeliveryEstimate {
  distance: number // in miles
  cost: number // in Naira (₦)
  duration?: string
  route?: any
}

export interface Coordinates {
  longitude: number
  latitude: number
}

export interface Address {
  address: string
  city: string
  state: string
  country: string
}

const MAPBOX_ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN

export class MapboxService {
  private baseUrl = 'https://api.mapbox.com'
  private deliveryRatePerMile = 1000 // ₦1,000 per mile

  async geocodeAddress(address: Address): Promise<Coordinates | null> {
    if (!MAPBOX_ACCESS_TOKEN) {
      console.warn('Mapbox access token not found')
      return null
    }

    try {
      const query = encodeURIComponent(`${address.address}, ${address.city}, ${address.state}, ${address.country}`)
      const response = await fetch(
        `${this.baseUrl}/geocoding/v5/mapbox.places/${query}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=ng&limit=1`
      )
      
      if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.features && data.features.length > 0) {
        const [longitude, latitude] = data.features[0].center
        return { longitude, latitude }
      }
      
      return null
    } catch (error) {
      console.error('Geocoding error:', error)
      return null
    }
  }

  async calculateDistance(origin: Coordinates, destination: Coordinates): Promise<{ distance: number; duration: string } | null> {
    if (!MAPBOX_ACCESS_TOKEN) {
      console.warn('Mapbox access token not found')
      return null
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/directions/v5/mapbox/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?access_token=${MAPBOX_ACCESS_TOKEN}&geometries=geojson`
      )
      
      if (!response.ok) {
        throw new Error(`Directions API failed: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0]
        const distanceMeters = route.distance
        const durationSeconds = route.duration
        
        // Convert meters to miles
        const distanceMiles = distanceMeters * 0.000621371
        
        // Format duration
        const hours = Math.floor(durationSeconds / 3600)
        const minutes = Math.floor((durationSeconds % 3600) / 60)
        const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
        
        return {
          distance: parseFloat(distanceMiles.toFixed(2)),
          duration
        }
      }
      
      return null
    } catch (error) {
      console.error('Distance calculation error:', error)
      return null
    }
  }

  async estimateDelivery(vendorAddress: Address, customerAddress: Address): Promise<DeliveryEstimate | null> {
    try {
      // Geocode both addresses
      const [vendorCoords, customerCoords] = await Promise.all([
        this.geocodeAddress(vendorAddress),
        this.geocodeAddress(customerAddress)
      ])

      if (!vendorCoords || !customerCoords) {
        console.error('Failed to geocode one or both addresses')
        return null
      }

      // Calculate distance and duration
      const distanceInfo = await this.calculateDistance(vendorCoords, customerCoords)
      
      if (!distanceInfo) {
        console.error('Failed to calculate distance')
        return null
      }

      // Calculate cost based on distance
      const cost = Math.max(500, Math.round(distanceInfo.distance * this.deliveryRatePerMile)) // Minimum ₦500

      return {
        distance: distanceInfo.distance,
        cost,
        duration: distanceInfo.duration
      }
    } catch (error) {
      console.error('Delivery estimation error:', error)
      return null
    }
  }

  // Fallback pricing based on states/cities within Nigeria
  getFallbackDeliveryCost(customerCity: string, customerState: string): number {
    const city = customerCity.toLowerCase()
    const state = customerState.toLowerCase()

    // Major cities - cheaper delivery
    const majorCities = ['lagos', 'abuja', 'kano', 'ibadan', 'benin city', 'port harcourt']
    if (majorCities.some(major => city.includes(major))) {
      return 1000
    }

    // State capitals and large cities
    const stateCities = [
      'abeokuta', 'umuahia', 'awka', 'bauchi', 'yenagoa', 'makurdi', 'calabar',
      'asaba', 'abakaliki', 'ado ekiti', 'enugu', 'gombe', 'owerri', 'kaduna',
      'katsina', 'birnin kebbi', 'ilorin', 'awka', 'lafia', 'minna', 'akure',
      'osogbo', 'jos', 'lokoja', 'sokoto', 'jalingo', 'damaturu', 'gusau'
    ]
    
    if (stateCities.some(stateCity => city.includes(stateCity))) {
      return 1500
    }

    // Remote/rural areas
    return 2500
  }
}

export const mapboxService = new MapboxService()