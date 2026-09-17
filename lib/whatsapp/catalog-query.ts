export interface CatalogQuery {
  term: string
  maxPrice?: number
  // "between 10k and 20k", "10k to 20k", "around 15k" (±30%), "above 5k"
  minPrice?: number
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
  const AMOUNT = '(?:₦|ngn\\s*|n)?(\\d[\\d,]*(?:\\.\\d+)?\\s*[km]?)'
  let maxPrice: number | undefined
  let minPrice: number | undefined
  const cut = (match: RegExpMatchArray) => {
    const start = match.index ?? 0
    term = `${term.slice(0, start)} ${term.slice(start + match[0].length)}`.replace(/\b(?:for|at|priced?|that is|that are|thats|costing)\s*$/i, '').replace(/\s+/g, ' ').trim()
  }
  const range = term.match(new RegExp(`\\b(?:between\\s+)?${AMOUNT}\\s*(?:to|-|–|and)\\s*${AMOUNT}\\b`, 'i'))
  const around = !range && term.match(new RegExp(`\\b(?:around|about|approximately|roughly|like|within)\\s*${AMOUNT}\\b`, 'i'))
  const budget = !range && !around && term.match(new RegExp(`\\b(?:under|below|less than|not more than|up to|maximum|max|at most|within)\\s*${AMOUNT}\\b`, 'i'))
  const floor = !range && term.match(new RegExp(`\\b(?:above|over|more than|from|at least|minimum|min)\\s*${AMOUNT}\\b`, 'i'))
  if (range) {
    const low = parseAmount(range[1])
    const high = parseAmount(range[2])
    if (low && high) {
      minPrice = Math.min(low, high)
      maxPrice = Math.max(low, high)
      cut(range)
    }
  } else if (around) {
    const centre = parseAmount(around[1])
    if (centre) {
      minPrice = Math.round(centre * 0.7)
      maxPrice = Math.round(centre * 1.3)
      cut(around)
    }
  } else {
    if (budget) {
      const amount = parseAmount(budget[1])
      if (amount) { maxPrice = amount; cut(budget) }
    }
    if (floor) {
      const amount = parseAmount(floor[1])
      if (amount) { minPrice = amount; cut(floor) }
    }
  }
  // "sneakers for my son" / "a gift for my wife" — who it's for isn't part of the name.
  term = term.replace(/\b(?:for|to give|as a gift for)\s+(?:my|his|her|our|their|a|an|the)?\s*(?:son|daughter|wife|husband|mum|mom|mother|dad|father|brother|sister|friend|baby|kid|kids|children|boyfriend|girlfriend|fiancee?|self|myself|boss|colleague|partner|niece|nephew|aunt|uncle|grandma|grandpa|birthday|wedding|party|office|school|church|work|gym|travel|holiday)\b(?:'s)?(?:\s+\w+)?$/i, '').trim()
  const sortByPrice = /\b(?:cheap(?:est)?|affordable|budget|lowest price|low price)\b/i.test(term)
  term = term.replace(FILLER_WORDS, ' ').replace(/\s+/g, ' ').trim()
  let size: string | undefined
  const sizeMatch = term.match(/\b(?:size|sz)\s*[:\-]?\s*((?:uk|eu|us)?\s*\d{1,2}(?:\.5)?|xxs|xs|s|m|l|xl|xxl|xxxl|small|medium|large|extra large)\b/i)
    || term.match(/\b((?:uk|eu|us)\s*\d{1,2}(?:\.5)?)\b/i)
  if (sizeMatch) {
    size = sizeMatch[1].replace(/\s+/g, ' ').trim().toUpperCase()
    term = `${term.slice(0, sizeMatch.index)} ${term.slice((sizeMatch.index ?? 0) + sizeMatch[0].length)}`.replace(/\b(?:in|for|of)\s*$/i, '').trim()
  }
  return { term: term.replace(/\s+/g, ' '), ...(maxPrice ? { maxPrice } : {}), ...(minPrice ? { minPrice } : {}), ...(size ? { size } : {}), ...(sortByPrice ? { sortByPrice: true } : {}) }
}
