// The "logistics engine" — runs every enabled provider's quote fetch in parallel and
// merges the results into one list per vendor, from which the checkout UI derives its
// Express (fastest) / Standard (cheapest) choice. Adding a future provider (Fez, Travo,
// GIGL, ...) is just implementing LogisticsProvider and adding it to PROVIDERS below.
import { shipbubbleProvider } from './providers/shipbubble'
import { kwikProvider } from './providers/kwik'
import { fezProvider } from './providers/fez'
import type { CourierQuote, LogisticsProvider, LogisticsProviderId, LogisticsQuoteParams } from './types'

const PROVIDERS: LogisticsProvider[] = [shipbubbleProvider, kwikProvider, fezProvider]

// Flat markup added to every real quote before it's ever shown to a buyer — MakeItSell's
// margin on delivery. Applied here, once, to CourierQuote.total only — never touches
// quoteRef, so booking still pays each provider their real, unmarked-up rate. The
// TEST_STORE_VENDOR_ID synthetic quote (lib/delivery-quotes.ts) never reaches this
// engine at all, so it stays free regardless.
const DELIVERY_FEE_MARKUP_NGN = 1000

export type MergedQuotesResult = {
  couriers: CourierQuote[]
  cheapest: CourierQuote | null
  fastest: CourierQuote | null
}

export async function getMergedQuotesForVendor(params: LogisticsQuoteParams): Promise<MergedQuotesResult> {
  const enabledProviders = PROVIDERS.filter((p) => p.isEnabled())

  const settled = await Promise.allSettled(enabledProviders.map((p) => p.getQuotes(params)))
  const couriers: CourierQuote[] = []
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      for (const quote of result.value) {
        couriers.push({ ...quote, total: quote.total + DELIVERY_FEE_MARKUP_NGN })
      }
    } else {
      console.error('[logistics-engine] A provider failed to quote:', result.reason)
    }
  }

  if (couriers.length === 0) {
    return { couriers: [], cheapest: null, fastest: null }
  }

  const cheapest = couriers.reduce((min, c) => (c.total < min.total ? c : min), couriers[0])
  // Quotes with no known ETA never win "fastest" over ones with a real number — falls
  // back to the cheapest option when nothing in the merged set has an ETA at all.
  const withEta = couriers.filter((c) => c.etaHours != null)
  const fastest = withEta.length > 0
    ? withEta.reduce((min, c) => (c.etaHours! < min.etaHours! ? c : min), withEta[0])
    : cheapest

  return { couriers, cheapest, fastest }
}

export function findLogisticsProvider(id: LogisticsProviderId): LogisticsProvider | null {
  return PROVIDERS.find((p) => p.id === id) || null
}
