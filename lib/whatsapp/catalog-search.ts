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
  return []
}
