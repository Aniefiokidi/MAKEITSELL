export interface CatalogQuery {
  term: string
  maxPrice?: number
  // A size the buyer mentioned ("size 42", "UK 8", "XL") — pulled out of the search term
  // so it doesn't sink the match; shown back to them when choosing a variant.
  size?: string
  // "cheapest sneakers" / "affordable phones": show the lowest prices first.
  sortByPrice?: boolean
}

// Words that describe what the buyer hopes for, not what the item is called. They never
// appear in product names the way the buyer types them, so they only sink the match.
const FILLER_WORDS = /\b(?:cheap(?:est)?|affordable|budget(?:-friendly)?|good|nice|fine|quality|high[- ]quality|best|original|authentic|genuine|beautiful|lovely|latest|new|brand new|durable|strong|correct|sharp|clean|neat|top|premium|classy|trending|hot)\b/gi

function parseAmount(value: string): number | undefined {
  const cleaned = value.replace(/,/g, '').replace(/\s+/g, '').toLowerCase()
  const match = cleaned.match(/^(\d+(?:\.\d+)?)(k|m)?$/)
  if (!match) return undefined
  const amount = Number(match[1]) * (match[2] === 'm' ? 1_000_000 : match[2] === 'k' ? 1_000 : 1)
  return Number.isFinite(amount) && amount > 0 ? amount : undefined
}

// Parse only explicit limits. A vague phrase such as "cheap phones" is left intact so
// the bot never invents a buyer's budget.
export function parseCatalogQuery(input: string): CatalogQuery {
  let term = input.trim().replace(/\s+/g, ' ')
  const budget = term.match(/\b(?:under|below|less than|up to|maximum|max)\s*(?:₦|ngn\s*)?(\d[\d,]*(?:\.\d+)?\s*[km]?)\b/i)
  const maxPrice = budget ? parseAmount(budget[1]) : undefined
  if (budget && maxPrice) {
    const start = budget.index ?? 0
    term = `${term.slice(0, start)} ${term.slice(start + budget[0].length)}`
      .replace(/\b(?:for|at|priced?)\s*$/i, '')
      .trim()
  }
  const sortByPrice = /\b(?:cheap(?:est)?|affordable|budget|lowest price|low price)\b/i.test(term)
  term = term.replace(FILLER_WORDS, ' ').replace(/\s+/g, ' ').trim()
  let size: string | undefined
  const sizeMatch = term.match(/\b(?:size|sz)\s*[:\-]?\s*((?:uk|eu|us)?\s*\d{1,2}(?:\.5)?|xxs|xs|s|m|l|xl|xxl|xxxl|small|medium|large|extra large)\b/i)
    || term.match(/\b((?:uk|eu|us)\s*\d{1,2}(?:\.5)?)\b/i)
  if (sizeMatch) {
    size = sizeMatch[1].replace(/\s+/g, ' ').trim().toUpperCase()
    term = `${term.slice(0, sizeMatch.index)} ${term.slice((sizeMatch.index ?? 0) + sizeMatch[0].length)}`.replace(/\b(?:in|for|of)\s*$/i, '').trim()
  }
  return { term: term.replace(/\s+/g, ' '), ...(maxPrice ? { maxPrice } : {}), ...(size ? { size } : {}), ...(sortByPrice ? { sortByPrice: true } : {}) }
}
