import { mapboxService } from "@/lib/mapbox"

export type LocationPricingRule = {
  id: string
  label: string
  matchType: "state" | "city" | "contains"
  matchValue: string
  fixedAdjustment?: number
  percentageAdjustment?: number
  active?: boolean
}

function normalize(value: string): string {
  return String(value || "").trim().toLowerCase()
}

function matchesRule(rule: LocationPricingRule, customerLocation: string): boolean {
  const value = normalize(customerLocation)
  const ruleValue = normalize(rule.matchValue)
  if (!value || !ruleValue) return false

  if (rule.matchType === "contains") {
    return value.includes(ruleValue)
  }

  if (rule.matchType === "state") {
    return value === ruleValue || value.endsWith(`, ${ruleValue}`) || value.includes(` ${ruleValue} `)
  }

  return value.startsWith(ruleValue) || value.includes(` ${ruleValue}`)
}

export async function applyLocationPricing(params: {
  basePrice: number
  customerLocation?: string
  serviceLocation?: string
  locationPricingRules?: LocationPricingRule[]
  distanceRatePerMile?: number
}): Promise<{ total: number; adjustment: number; notes: string[] }> {
  const {
    basePrice,
    customerLocation,
    serviceLocation,
    locationPricingRules = [],
    distanceRatePerMile = 0,
  } = params

  let adjustment = 0
  const notes: string[] = []

  const locationText = String(customerLocation || "").trim()
  if (locationText) {
    for (const rule of locationPricingRules) {
      if (!rule || rule.active === false) continue
      if (!matchesRule(rule, locationText)) continue

      const fixed = Number(rule.fixedAdjustment || 0)
      const percent = Number(rule.percentageAdjustment || 0)
      if (Number.isFinite(fixed)) {
        adjustment += fixed
      }
      if (Number.isFinite(percent) && percent !== 0) {
        adjustment += (basePrice * percent) / 100
      }
      notes.push(`Rule applied: ${rule.label}`)
    }
  }

  if (distanceRatePerMile > 0 && locationText && serviceLocation) {
    try {
      const parseAddress = (raw: string) => {
        const chunks = raw.split(",").map((part) => part.trim()).filter(Boolean)
        const city = chunks[1] || chunks[0] || ""
        const state = chunks[2] || chunks[1] || ""
        return {
          address: chunks[0] || raw,
          city,
          state,
          country: "Nigeria",
        }
      }

      const estimate = await mapboxService.estimateDelivery(parseAddress(serviceLocation), parseAddress(locationText))
      if (estimate && Number.isFinite(estimate.distance)) {
        const distanceFee = Math.max(0, estimate.distance * distanceRatePerMile)
        adjustment += distanceFee
        notes.push(`Distance fee applied (${estimate.distance.toFixed(2)}mi)`)
      }
    } catch {
      // Ignore map failures and keep deterministic rule-based pricing.
    }
  }

  const total = Math.max(0, Math.round((basePrice + adjustment) * 100) / 100)
  return {
    total,
    adjustment: Math.round(adjustment * 100) / 100,
    notes,
  }
}

export function computeCancellationFee(params: {
  bookingDate: Date
  startTime: string
  amount: number
  policyPercent?: number
  windowHours?: number
}): { shouldCharge: boolean; feeAmount: number; hoursUntilBooking: number } {
  const {
    bookingDate,
    startTime,
    amount,
    policyPercent = 30,
    windowHours = 24,
  } = params

  const [hours, minutes] = String(startTime || "00:00").split(":").map((v) => Number(v || 0))
  const startDateTime = new Date(bookingDate)
  startDateTime.setHours(hours, minutes, 0, 0)

  const diffMs = startDateTime.getTime() - Date.now()
  const hoursUntilBooking = diffMs / (1000 * 60 * 60)

  if (hoursUntilBooking >= windowHours) {
    return { shouldCharge: false, feeAmount: 0, hoursUntilBooking }
  }

  const feeAmount = Math.max(0, Math.round((Number(amount || 0) * policyPercent) / 100))
  return {
    shouldCharge: feeAmount > 0,
    feeAmount,
    hoursUntilBooking,
  }
}
