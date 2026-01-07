"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { MapPin, Search, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface LocationPickerProps {
  onLocationSelect: (location: {
    address: string
    coordinates?: { lat: number; lng: number }
    city?: string
    state?: string
    country?: string
  }) => void
  initialAddress?: string
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
}

export default function LocationPicker({ 
  onLocationSelect, 
  initialAddress = '',
  value,
  onChange,
  placeholder = 'Search for your location...'
}: LocationPickerProps) {
  const [searchQuery, setSearchQuery] = useState(initialAddress)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_API_KEY

  const searchLocation = useCallback(async (query: string) => {
    if (!query || query.length < 3 || !MAPBOX_TOKEN) {
      setSuggestions([])
      return
    }

    setLoading(true)
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&country=NG&types=place,locality,neighborhood,address&limit=5`
      )
      const data = await response.json()
      
      if (data.features) {
        setSuggestions(data.features)
        setShowSuggestions(true)
      }
    } catch (error) {
      console.error('Error fetching location suggestions:', error)
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [MAPBOX_TOKEN])

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery) {
        searchLocation(searchQuery)
      }
    }, 300)

    return () => clearTimeout(debounce)
  }, [searchQuery, searchLocation])

  const handleSelectLocation = (feature: any) => {
    const address = feature.place_name
    const [lng, lat] = feature.center
    
    // Extract city, state, country from context
    const city = feature.context?.find((c: any) => c.id.startsWith('place'))?.text
    const state = feature.context?.find((c: any) => c.id.startsWith('region'))?.text
    const country = feature.context?.find((c: any) => c.id.startsWith('country'))?.text

    setSearchQuery(address)
    setShowSuggestions(false)
    
    onLocationSelect({
      address,
      coordinates: { lat, lng },
      city,
      state,
      country
    })
  }

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          value={value !== undefined ? value : searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            if (onChange) onChange(e.target.value)
          }}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder={placeholder}
          className="pl-10 pr-10"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {!loading && searchQuery && (
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.id}-${index}`}
              type="button"
              onClick={() => handleSelectLocation(suggestion)}
              className="w-full px-4 py-3 text-left hover:bg-accent hover:text-accent-foreground transition-colors flex items-start gap-2 border-b last:border-b-0"
            >
              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{suggestion.text}</p>
                <p className="text-xs text-muted-foreground truncate">{suggestion.place_name}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {!MAPBOX_TOKEN && (
        <p className="text-xs text-muted-foreground mt-1">
          Map search unavailable. Please enter your address manually.
        </p>
      )}
    </div>
  )
}
