// Search tuned for a short WhatsApp conversation: prefer an item whose name or
// category matches the request before considering broad description-only text hits.
// Keep the same query choice across "more" pages by testing for existence before skip.
import connectToDatabase from '@/lib/mongodb'
import { Product } from '@/lib/models/Product'
import { getProducts } from '@/lib/mongodb-operations'

const SEARCH_FIELDS = ['name', 'category', 'subcategory'] as const

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function fieldMatches(expression: RegExp) {
  return { $or: SEARCH_FIELDS.map((field) => ({ [field]: expression })) }
}

export async function searchCatalogProducts(query: string, offset: number, limit: number): Promise<any[]> {
  await connectToDatabase()
  const normalized = query.trim().replace(/\s+/g, ' ').slice(0, 80)
  if (!normalized) return []

  const words = normalized.split(' ').filter((word) => word.length > 1)
  const candidates: any[] = [
    { status: 'active', ...fieldMatches(new RegExp(escapeRegex(normalized), 'i')) },
  ]
  if (words.length > 1) {
    candidates.push({
      status: 'active',
      $and: words.map((word) => fieldMatches(new RegExp(escapeRegex(word), 'i'))),
    })
  }

  for (const filter of candidates) {
    if (await Product.exists(filter)) {
      const matches: any[] = await Product.find(filter)
        .sort({ featured: -1, createdAt: -1, _id: -1 })
        .skip(offset)
        .limit(limit)
        .lean()
      return matches.map((product) => ({ ...product, id: String(product._id) }))
    }
  }

  // Covers stemming and alternate wording when no direct catalog-field match exists.
  return getProducts({ search: normalized, status: 'active', skipCount: offset, limitCount: limit })
}
