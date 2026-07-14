import L from "leaflet"

// Leaflet's default marker icon paths break under Next.js bundling — use inline SVG divIcons instead.
export function makeDivIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:20px;height:20px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}

export const riderIcon = makeDivIcon("#16a34a")
export const destinationIcon = makeDivIcon("#7f1d1d")
