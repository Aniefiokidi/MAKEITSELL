"use client"

import { useMemo } from "react"
import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { riderIcon, destinationIcon } from "./LeafletIcons"

interface LeafletTrackingMapProps {
  riderPosition: { lat: number; lng: number } | null
  destination: { lat: number; lng: number }
}

export default function LeafletTrackingMap({ riderPosition, destination }: LeafletTrackingMapProps) {
  const center = useMemo<[number, number]>(() => {
    if (riderPosition) return [riderPosition.lat, riderPosition.lng]
    return [destination.lat, destination.lng]
  }, [riderPosition, destination])

  const line = useMemo<[number, number][] | null>(() => {
    if (!riderPosition) return null
    return [
      [riderPosition.lat, riderPosition.lng],
      [destination.lat, destination.lng],
    ]
  }, [riderPosition, destination])

  return (
    <div className="h-72 sm:h-96 w-full rounded-md overflow-hidden border">
      <MapContainer center={center} zoom={14} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[destination.lat, destination.lng]} icon={destinationIcon} />
        {riderPosition ? <Marker position={[riderPosition.lat, riderPosition.lng]} icon={riderIcon} /> : null}
        {line ? <Polyline positions={line} pathOptions={{ color: "#7f1d1d", dashArray: "6 8" }} /> : null}
      </MapContainer>
    </div>
  )
}
