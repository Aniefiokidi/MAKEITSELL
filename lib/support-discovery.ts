// Live DB-backed enrichment for the support bot's "I can't find a specific FAQ for
// this" fallback path. The FAQ matcher itself stays a pure, deterministic keyword
// lookup (no DB access) — this module is a separate, optional layer the API route
// consults only when the FAQ matcher already decided it has nothing specific to say,
// so a query naming an actual product or service ("i want order shoe", "I need a
// plumber") can point at real stores/providers instead of a generic "go browse" reply.

import { getProducts, getServices } from "@/lib/mongodb-operations"
import { buildPublicStorePath, buildPublicServicePath } from "@/lib/public-links"
import { Store } from "@/lib/models/Store"
import { normalize, tokenize } from "@/lib/support-faq"
import type { FaqResponse } from "@/lib/support-faq"

// Distinct from the core matcher's stopword-free ordered-phrase matching (that
// architecture is deliberate, see support-faq.ts) — this is a different job: reducing
// a free-form query down to the noun the customer is actually looking for, so removing
// filler words here is safe and doesn't risk the false-match regressions that ruled out
// stopwords in the FAQ matcher itself.
const EXTRACTION_STOPWORDS = new Set([
  'i', 'want', 'to', 'do', 'does', 'did', 'you', 'your', 'my', 'me', 'can', 'could',
  'please', 'find', 'buy', 'order', 'purchase', 'get', 'need', 'needing', 'looking',
  'look', 'for', 'where', 'how', 'is', 'are', 'am', 'the', 'a', 'an', 'some', 'any',
  'that', 'this', 'of', 'in', 'on', 'at', 'sell', 'sells', 'selling', 'have', 'has',
  'offer', 'offers', 'offering', 'shop', 'shopping', 'search', 'searching', 'help',
  'with', 'from', 'there', 'be', 'it', 'know', 'tell', 'product', 'products', 'item',
  'items', 'something', 'anything', 'store', 'stores', 'vendor', 'vendors', 'service',
  'services', 'provider', 'providers', 'book', 'booking',
  // Leftovers from Pidgin normalization (dem->they, dey->are, etc.) and other filler
  // that isn't part of a product/service name — these were showing up in the search
  // term echoed back to the customer ("I found **they shoe**") and, for short ones
  // like "no"/"go", causing noisy substring matches against unrelated products.
  'no', 'not', 'never', 'na', 'e', 'go', 'going', 'gone', 'they', 'them', 'these',
  'those', 'will', 'would', 'should', 'much', 'many', 'let', 'app', 'apps',
  'application', 'account', 'still', 'again', 'yet', 'also', 'us', 'our',
])

function extractSearchTerm(rawQuery: string): string | null {
  const normalized = normalize(rawQuery)
  const tokens = tokenize(normalized).filter((t) => t.length > 1 && !EXTRACTION_STOPWORDS.has(t))
  if (tokens.length === 0) return null
  return tokens.join(' ')
}

// Full phrase first (most precise), then individual words longest-first (most likely
// to be the core noun) — so "leather shoe" tries the full phrase, then falls back to
// "leather" and "shoe" individually if nothing matches the exact phrase.
function buildCandidateTerms(term: string): string[] {
  const tokens = term.split(' ').filter(Boolean)
  const candidates = [term]
  for (const t of [...tokens].sort((a, b) => b.length - a.length)) {
    if (!candidates.includes(t)) candidates.push(t)
  }
  return candidates.slice(0, 3)
}

interface StoreLead { name: string; link: string }
interface ServiceLead { name: string; providerName: string; link: string }

async function findMatchingStores(term: string, limit = 4): Promise<StoreLead[]> {
  for (const candidate of buildCandidateTerms(term)) {
    const products = await getProducts({ search: candidate, limitCount: 20 })
    if (products.length === 0) continue

    const vendorIds = [...new Set(products.map((p: any) => String(p.vendorId || '')).filter(Boolean))]
    if (vendorIds.length === 0) continue

    const stores = await Store.find({ vendorId: { $in: vendorIds }, isActive: { $ne: false } }).lean()
    const leads = (stores as any[])
      .slice(0, limit)
      .map((s) => ({ name: String(s.storeName || 'Store'), link: buildPublicStorePath(s) }))
    if (leads.length > 0) return leads
  }
  return []
}

async function findMatchingServiceProviders(term: string, limit = 4): Promise<ServiceLead[]> {
  for (const candidate of buildCandidateTerms(term)) {
    const services = await getServices({ search: candidate, limitCount: 20 })
    if (services.length === 0) continue

    const seenProviders = new Set<string>()
    const leads: ServiceLead[] = []
    for (const svc of services as any[]) {
      const providerId = String(svc.providerId || '')
      if (providerId && seenProviders.has(providerId)) continue
      if (providerId) seenProviders.add(providerId)
      leads.push({
        name: String(svc.title || svc.name || 'Service'),
        providerName: String(svc.providerName || 'Provider'),
        link: buildPublicServicePath(svc),
      })
      if (leads.length >= limit) break
    }
    if (leads.length > 0) return leads
  }
  return []
}

export async function buildDiscoveryReply(
  rawQuery: string,
  lang: 'en' | 'pcm',
  userName?: string,
  hasIntentSignal?: boolean
): Promise<FaqResponse | null> {
  const term = extractSearchTerm(rawQuery)
  if (!term) return null

  const [stores, services] = await Promise.all([
    findMatchingStores(term),
    findMatchingServiceProviders(term),
  ])

  const greeting = userName ? `${userName}, ` : ''

  if (stores.length === 0 && services.length === 0) {
    // Only worth saying something specific when the query actually signaled shopping/
    // booking intent ("i want paint nails") — otherwise a truly unrelated or gibberish
    // query is better served by the existing generic capability menu than by echoing
    // back a search term that was never really a product/service name.
    if (!hasIntentSignal) return null

    const notFoundBody = lang === 'pcm'
      ? `I no fit find anything wey match "**${term}**" right now. You fit search direct for **/products** or **/services**, or try another word.`
      : `I couldn't find anything matching "**${term}**" right now. You can search directly at **/products** or **/services**, or try a different word.`

    return {
      canResolve: true,
      response: greeting ? `${greeting}${notFoundBody}` : notFoundBody,
      suggestedActions: ['Browse products', 'Browse services', 'Talk to a human agent'],
      priority: 'low',
    }
  }
  const sections: string[] = []

  if (stores.length > 0) {
    const list = stores.map((s) => `• [${s.name}](${s.link})`).join('\n')
    sections.push(
      lang === 'pcm'
        ? `I see **${term}** for these stores:\n\n${list}`
        : `I found **${term}** at these stores:\n\n${list}`
    )
  }

  if (services.length > 0) {
    const list = services.map((s) => `• [${s.name}](${s.link}) — ${s.providerName}`).join('\n')
    sections.push(
      lang === 'pcm'
        ? `See providers wey get **${term}**:\n\n${list}`
        : `Here are providers offering **${term}**:\n\n${list}`
    )
  }

  const closing = lang === 'pcm'
    ? '\n\nTap one make you see full details, or browse everything for **/products** and **/services**.'
    : '\n\nTap one to see full details, or browse everything at **/products** and **/services**.'

  const body = `${sections.join('\n\n')}${closing}`

  return {
    canResolve: true,
    response: greeting ? `${greeting}${body}` : body,
    suggestedActions: lang === 'pcm'
      ? ['Browse products', 'Browse services', 'Search for something else']
      : ['Browse products', 'Browse services', 'Search for something else'],
    priority: 'medium',
  }
}
