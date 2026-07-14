"use client"

import { useMemo } from "react"
import { MapContainer, TileLayer, Marker } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { destinationIcon } from "./LeafletIcons"

interface PinPickerMapProps {
  lat: number
  lng: number
  onChange: (lat: number, lng: number) => void
}

export default function PinPickerMap({ lat, lng, onChange }: PinPickerMapProps) {
  const center = useMemo<[number, number]>(() => [lat, lng], [lat, lng])

  return (
    <div className="h-56 w-full rounded-md overflow-hidden border">
      <MapContainer center={center} zoom={15} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker
          position={center}
          icon={destinationIcon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target
              const position = marker.getLatLng()
              onChange(position.lat, position.lng)
            },
          }}
        />
      </MapContainer>
    </div>
  )
}
