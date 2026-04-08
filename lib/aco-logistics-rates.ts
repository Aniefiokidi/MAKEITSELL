type RouteName =
  | "Route 1"
  | "Route 2"
  | "Route 3"
  | "Route 4"
  | "Route 5"
  | "Route 6"
  | "Route 7"
  | "Route 8"
  | "Route 9"
  | "Route 10"
  | "Route 11"
  | "Route 12"
  | "Route 13"

type RoutesMap = Record<RouteName, string[]>
type PricingMatrix = Record<RouteName, Record<RouteName, number>>

export const acoLogisticsRates: {
  company: string
  routes: RoutesMap
  pricingMatrix: PricingMatrix
  interstateRoutes: {
    from: string
    zones: Array<{ zone: string; price: number; states: string[] }>
  }
} = {
  company: "A&CO Logistics",
  routes: {
    "Route 1": ["Ikeja", "Maryland", "Anthony"],
    "Route 2": ["Ilupeju", "Palmgroove", "Jibowu", "Yaba", "Surulere"],
    "Route 3": ["Mushin", "Oshodi", "Isolo", "Okota"],
    "Route 4": ["Festac", "Satellite Town"],
    "Route 5": ["Apapa", "Ojo", "Iba"],
    "Route 6": ["Magodo", "Omole", "Ojodu Berger", "Ogba", "Agege"],
    "Route 7": ["Ogudu", "Ketu", "Gbagada"],
    "Route 8": ["Iju-Ishaga", "Abule-Egba", "Iyana-Ipaja"],
    "Route 9": ["Ayobo", "Egbeda", "Ejigbo", "Ikotun", "Igando"],
    "Route 10": ["Marina", "Lagos-Island", "Ikoyi", "Victoria Island"],
    "Route 11": ["Lekki-Phase 1", "Elegushi", "Jakande", "Agungi", "Chevron"],
    "Route 12": ["Ikota", "VGC", "Ajah", "Abraham Adesanya"],
    "Route 13": ["Ikorodu"],
  },
  pricingMatrix: {
    "Route 1": { "Route 1": 2500, "Route 2": 3500, "Route 3": 4000, "Route 4": 5000, "Route 5": 6000, "Route 6": 3500, "Route 7": 3000, "Route 8": 5000, "Route 9": 6000, "Route 10": 5000, "Route 11": 5000, "Route 12": 6000, "Route 13": 5000 },
    "Route 2": { "Route 1": 3500, "Route 2": 2500, "Route 3": 3500, "Route 4": 5000, "Route 5": 5000, "Route 6": 5000, "Route 7": 4000, "Route 8": 5000, "Route 9": 6000, "Route 10": 5000, "Route 11": 5000, "Route 12": 6000, "Route 13": 6000 },
    "Route 3": { "Route 1": 4000, "Route 2": 3500, "Route 3": 2500, "Route 4": 3500, "Route 5": 5000, "Route 6": 5000, "Route 7": 4500, "Route 8": 5500, "Route 9": 4000, "Route 10": 5000, "Route 11": 5000, "Route 12": 6000, "Route 13": 6000 },
    "Route 4": { "Route 1": 5000, "Route 2": 5000, "Route 3": 3500, "Route 4": 2500, "Route 5": 4000, "Route 6": 6000, "Route 7": 4500, "Route 8": 7500, "Route 9": 4500, "Route 10": 5000, "Route 11": 6000, "Route 12": 7000, "Route 13": 8000 },
    "Route 5": { "Route 1": 6000, "Route 2": 5000, "Route 3": 5000, "Route 4": 4000, "Route 5": 2500, "Route 6": 7000, "Route 7": 6000, "Route 8": 7500, "Route 9": 5000, "Route 10": 6000, "Route 11": 6000, "Route 12": 7000, "Route 13": 8000 },
    "Route 6": { "Route 1": 3500, "Route 2": 5000, "Route 3": 5000, "Route 4": 6000, "Route 5": 7000, "Route 6": 2500, "Route 7": 4500, "Route 8": 4000, "Route 9": 5500, "Route 10": 5000, "Route 11": 6000, "Route 12": 7000, "Route 13": 6000 },
    "Route 7": { "Route 1": 3500, "Route 2": 4000, "Route 3": 4500, "Route 4": 4500, "Route 5": 6000, "Route 6": 4500, "Route 7": 2500, "Route 8": 4500, "Route 9": 5500, "Route 10": 4000, "Route 11": 5000, "Route 12": 6000, "Route 13": 5000 },
    "Route 8": { "Route 1": 5000, "Route 2": 5000, "Route 3": 5500, "Route 4": 7500, "Route 5": 7500, "Route 6": 4000, "Route 7": 4500, "Route 8": 2500, "Route 9": 6500, "Route 10": 6000, "Route 11": 6000, "Route 12": 7500, "Route 13": 8000 },
    "Route 9": { "Route 1": 6000, "Route 2": 6000, "Route 3": 4000, "Route 4": 4500, "Route 5": 5000, "Route 6": 5500, "Route 7": 5500, "Route 8": 6500, "Route 9": 2500, "Route 10": 6000, "Route 11": 6500, "Route 12": 7500, "Route 13": 8500 },
    "Route 10": { "Route 1": 5000, "Route 2": 5000, "Route 3": 5000, "Route 4": 5000, "Route 5": 6000, "Route 6": 5000, "Route 7": 4000, "Route 8": 6000, "Route 9": 6000, "Route 10": 2500, "Route 11": 4000, "Route 12": 5000, "Route 13": 8000 },
    "Route 11": { "Route 1": 5000, "Route 2": 5000, "Route 3": 5000, "Route 4": 6000, "Route 5": 6000, "Route 6": 6000, "Route 7": 5000, "Route 8": 6000, "Route 9": 6500, "Route 10": 4000, "Route 11": 2500, "Route 12": 3500, "Route 13": 9000 },
    "Route 12": { "Route 1": 6000, "Route 2": 6000, "Route 3": 6000, "Route 4": 7000, "Route 5": 7000, "Route 6": 7000, "Route 7": 6000, "Route 8": 7500, "Route 9": 7500, "Route 10": 5000, "Route 11": 3500, "Route 12": 2500, "Route 13": 10000 },
    "Route 13": { "Route 1": 5000, "Route 2": 6000, "Route 3": 7000, "Route 4": 8000, "Route 5": 8000, "Route 6": 6000, "Route 7": 5000, "Route 8": 9000, "Route 9": 8500, "Route 10": 8000, "Route 11": 9000, "Route 12": 10000, "Route 13": 3000 },
  },
  interstateRoutes: {
    from: "Lagos",
    zones: [
      { zone: "Zone A", price: 7000, states: ["Delta", "Edo", "Ekiti", "Kwara", "Ogun", "Ondo", "Osun", "Oyo"] },
      { zone: "Zone B", price: 8000, states: ["Abia", "Akwa-Ibom", "Anambra", "Cross-River", "Ebonyi", "Enugu", "Imo", "Rivers"] },
      {
        zone: "Zone C",
        price: 9000,
        states: [
          "Abuja", "Adamawa", "Bauchi", "Benue", "Borno", "Gombe", "Jigawa", "Jos", "Kaduna", "Kano", "Katsina", "Kebbi",
          "Kogi", "Nasarawa", "Niger", "Sokoto", "Taraba", "Yobe", "Zamfara",
        ],
      },
    ],
  },
}

function normalize(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "")
}

const lagosRouteAliases: Record<string, RouteName> = {
  etiosa: "Route 11",
  lekki: "Route 11",
  lekki1: "Route 11",
  lekiphase1: "Route 11",
  jakande: "Route 11",
  chevron: "Route 11",
  agungi: "Route 11",
  ikoyi: "Route 10",
  victoriabisland: "Route 10",
  victoriaisland: "Route 10",
  lagosisland: "Route 10",
  island: "Route 10",
  ajah: "Route 12",
  vgc: "Route 12",
  ikota: "Route 12",
  abrahamadesanya: "Route 12",
  ikorodu: "Route 13",
  alimosho: "Route 8",
  agege: "Route 6",
  ikeja: "Route 1",
  oshodi: "Route 3",
  mushin: "Route 3",
  surulere: "Route 2",
  yaba: "Route 2",
  maryland: "Route 1",
  ketu: "Route 7",
  gbagada: "Route 7",
  festac: "Route 4",
  apapa: "Route 5",
}

function inferRouteFromAliases(value: string): RouteName | null {
  const normalizedValue = normalize(value)
  if (!normalizedValue) return null

  if (lagosRouteAliases[normalizedValue]) {
    return lagosRouteAliases[normalizedValue]
  }

  for (const [alias, route] of Object.entries(lagosRouteAliases)) {
    if (normalizedValue.includes(alias)) {
      return route
    }
  }

  return null
}

export function getPrice(fromRoute: RouteName, toRoute: RouteName): number | null {
  return acoLogisticsRates.pricingMatrix[fromRoute]?.[toRoute] ?? null
}

export function findRoute(area: string): RouteName | null {
  const needle = normalize(area)
  const aliasRoute = inferRouteFromAliases(needle)
  if (aliasRoute) return aliasRoute

  for (const [route, areas] of Object.entries(acoLogisticsRates.routes) as Array<[RouteName, string[]]>) {
    if (areas.some((a) => normalize(a) === needle)) return route
  }
  return null
}

export function findRouteForAddress(address: string): RouteName | null {
  const haystack = normalize(address)
  const aliasRoute = inferRouteFromAliases(haystack)
  if (aliasRoute) return aliasRoute

  for (const [route, areas] of Object.entries(acoLogisticsRates.routes) as Array<[RouteName, string[]]>) {
    if (areas.some((a) => haystack.includes(normalize(a)))) return route
  }
  return null
}

export function getInterstatePrice(state: string): number | null {
  const needle = normalize(state)
  for (const zone of acoLogisticsRates.interstateRoutes.zones) {
    if (zone.states.some((s) => normalize(s) === needle)) return zone.price
  }
  return null
}

export function isLagosAddress(value: string): boolean {
  return normalize(value).includes("lagos")
}

export function estimateShippingFee(params: {
  pickupAddress: string
  dropoffAddress: string
  pickupCity?: string
  pickupState?: string
  dropoffCity?: string
  dropoffState?: string
}): number | null {
  const pickupAddress = String(params.pickupAddress || "")
  const dropoffAddress = String(params.dropoffAddress || "")
  const pickupCity = String(params.pickupCity || "")
  const pickupState = String(params.pickupState || "")
  const dropoffCity = String(params.dropoffCity || "")
  const dropoffState = String(params.dropoffState || "")

  const pickupHint = [pickupCity, pickupState].filter(Boolean).join(", ")
  const dropoffHint = [dropoffCity, dropoffState].filter(Boolean).join(", ")

  const pickupRoute = findRouteForAddress([pickupAddress, pickupHint].filter(Boolean).join(", "))
  const dropoffRoute = findRouteForAddress([dropoffAddress, dropoffHint].filter(Boolean).join(", "))

  const pickupIsLagos = isLagosAddress([pickupAddress, pickupCity, pickupState].filter(Boolean).join(", ")) || Boolean(pickupRoute)
  const dropoffIsLagos =
    isLagosAddress([dropoffAddress, dropoffCity, dropoffState].filter(Boolean).join(", ")) ||
    normalize(dropoffState) === "lagos" ||
    Boolean(dropoffRoute)

  // Stores outside Lagos remain TBD.
  if (!pickupIsLagos) {
    return null
  }

  // Intra-Lagos matrix pricing.
  if (dropoffIsLagos) {
    const fromRoute = pickupRoute
    const toRoute = dropoffRoute
    if (!fromRoute || !toRoute) return null
    return getPrice(fromRoute, toRoute)
  }

  // Interstate from Lagos pricing by destination state.
  if (dropoffState) {
    return getInterstatePrice(dropoffState)
  }

  return null
}
