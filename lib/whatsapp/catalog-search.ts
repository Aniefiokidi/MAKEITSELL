// Search tuned for a short WhatsApp conversation: prefer an item whose name or
// category matches the request before considering broad description-only text hits.
// Keep the same query choice across "more" pages by testing for existence before skip.
import connectToDatabase from '@/lib/mongodb'
import { Product } from '@/lib/models/Product'
import { parseCatalogQuery } from '@/lib/whatsapp/catalog-query'

const SEARCH_FIELDS = ['name', 'category', 'subcategory'] as const

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function fieldMatches(expression: RegExp) {
  return { $or: SEARCH_FIELDS.map((field) => ({ [field]: expression })) }
}

export async function searchCatalogProducts(query: string, offset: number, limit: number): Promise<any[]> {
  await connectToDatabase()
  const parsed = parseCatalogQuery(query)
  const normalized = parsed.term.slice(0, 80)
  if (normalized.length < 2) return []

  const words = normalized.split(' ').filter((word) => word.length > 1 && !['for', 'with', 'the', 'and', 'from', 'please'].includes(word.toLowerCase()))
  if (words.length === 0) return []
  const baseFilter = { status: 'active', stock: { $gt: 0 }, ...(parsed.maxPrice ? { price: { $lte: parsed.maxPrice } } : {}) }
  const candidates: any[] = [
    { ...baseFilter, ...fieldMatches(new RegExp(escapeRegex(normalized), 'i')) },
  ]
  if (words.length > 1) {
    candidates.push({
      ...baseFilter,
      $and: words.map((word) => fieldMatches(new RegExp(escapeRegex(word), 'i'))),
    })
  }
  candidates.push({
    ...baseFilter,
    $and: words.map((word) => ({
      $or: [...SEARCH_FIELDS, 'description'].map((field) => ({ [field]: new RegExp(escapeRegex(word), 'i') })),
    })),
  })

  for (const filter of candidates) {
    // First page needs only one query. Later pages check existence before skip so
    // reaching the end of a strong match tier never switches into weaker results.
    if (offset > 0 && !(await Product.exists(filter))) continue
    const matches: any[] = await Product.find(filter)
      .sort(parsed.maxPrice ? { price: 1, _id: -1 } : { featured: -1, createdAt: -1, _id: -1 })
      .skip(offset)
      .limit(limit)
      .lean()
    if (matches.length > 0 || offset > 0) return matches.map((product) => ({ ...product, id: String(product._id) }))
  }
  return fuzzyCatalogMatches(words, baseFilter, offset, limit)
}

// Damerau-Levenshtein (adjacent transpositions count as one edit) — "sneekers" vs
// "sneakers" is 1, "iphoen" vs "iphone" is 1.
function editDistance(a: string, b: string): number {
  const rows = a.length + 1
  const cols = b.length + 1
  const d: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0))
  for (let i = 0; i < rows; i++) d[i][0] = i
  for (let j = 0; j < cols; j++) d[0][j] = j
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

// How far a typed word may be from a catalog word and still count: none for short words
// ("bag" must not match "bat"), one edit for normal words, two for long ones.
function allowedEdits(word: string): number {
  if (word.length >= 8) return 2
  if (word.length >= 4) return 1
  return 0
}

// Closest match a product word gets to the typed word, or Infinity. Prefix matches cover
// singular/plural and stems ("sneaker"/"sneakers", "brace"/"bracelet").
function wordScore(typed: string, tokens: string[]): number {
  let best = Infinity
  for (const token of tokens) {
    if (token === typed) return 0
    if (typed.length >= 4 && (token.startsWith(typed) || typed.startsWith(token) && token.length >= 4)) best = Math.min(best, 0.5)
    const max = allowedEdits(typed)
    if (max > 0 && Math.abs(token.length - typed.length) <= max) {
      const distance = editDistance(typed, token)
      if (distance <= max) best = Math.min(best, distance)
    }
  }
  return best
}

// Last-resort tier: the exact tiers found nothing, so tolerate typos. Every typed word
// must land near some word of the product's name/category. Works on a capped in-memory
// projection since Mongo has no edit-distance operator; only ever reached on a miss.
const FUZZY_POOL_LIMIT = 5000

async function fuzzyCatalogMatches(words: string[], baseFilter: Record<string, unknown>, offset: number, limit: number): Promise<any[]> {
  const typed = words.map((w) => w.toLowerCase()).filter((w) => w.length >= 3)
  if (typed.length === 0) return []
  const pool: any[] = await Product.find(baseFilter).select('name category subcategory').limit(FUZZY_POOL_LIMIT).lean()
  const scored: Array<{ id: string; score: number }> = []
  for (const product of pool) {
    const tokens = [product.name, product.category, product.subcategory].join(' ').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
    let total = 0
    let ok = true
    for (const word of typed) {
      const score = wordScore(word, tokens)
      if (!Number.isFinite(score)) { ok = false; break }
      total += score
    }
    if (ok) scored.push({ id: String(product._id), score: total })
  }
  if (scored.length === 0) return []
  scored.sort((a, b) => a.score - b.score)
  const pageIds = scored.slice(offset, offset + limit).map((entry) => entry.id)
  if (pageIds.length === 0) return []
  const docs: any[] = await Product.find({ _id: { $in: pageIds } }).lean()
  const byId = new Map(docs.map((doc) => [String(doc._id), doc]))
  return pageIds.map((id) => byId.get(id)).filter(Boolean).map((product) => ({ ...product, id: String(product._id) }))
}
