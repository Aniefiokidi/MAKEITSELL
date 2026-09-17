export interface CatalogQuery {
  term: string
  maxPrice?: number
}

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
  return { term: term.replace(/\s+/g, ' '), ...(maxPrice ? { maxPrice } : {}) }
}
