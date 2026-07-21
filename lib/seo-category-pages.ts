import connectToDatabase from '@/lib/mongodb'
import { Product } from '@/lib/models/Product'
import { Store } from '@/lib/models/Store'
import { ServiceModel } from '@/lib/mongodb-operations'
import { NIGERIA_STATES } from '@/lib/nigeria-locations'

// Dedicated data layer for the /buy/[category]/[location] and /book/[category]/[location]
// SEO landing pages. Kept separate from getProducts/getServices in mongodb-operations.ts
// since neither of those supports a location join (Product has no state of its own —
// it lives on the vendor's Store — and this needs to stay a targeted, cheap query rather
// than growing the shared filter surface for a narrow use case).

export const CATEGORY_NAMES: Record<string, string> = {
  electronics: "Electronics",
  fashion: "Fashion",
  home: "Home & Garden",
  accessories: "Accessories",
  sports: "Sports & Fitness",
  audio: "Audio & Music",
  automotive: "Automotive",
  photography: "Photography",
  books: "Books & Media",
  gaming: "Gaming",
  beauty: "Beauty",
  "home-services": "Home Services",
  "logistics-delivery": "Logistics & Delivery",
  "health-wellness": "Health & Wellness",
  "business-services": "Business Services",
  events: "Events & Catering",
  "pet-care": "Pet Care",
  groceries: "Groceries",
  pharmacy: "Pharmacy",
  furniture: "Furniture",
  "toys-baby": "Toys & Baby",
}

export const SERVICE_CATEGORY_NAMES: Record<string, string> = {
  photography: "Photography",
  consulting: "Consulting",
  repairs: "Repairs & Maintenance",
  design: "Design & Creative",
  fitness: "Fitness & Wellness",
  education: "Education & Tutoring",
  beauty: "Beauty",
  cleaning: "Cleaning Services",
  tech: "Tech Support",
  rentals: "Rentals",
  hospitality: "Hotels & Apartments",
  marketing: "Marketing",
  legal: "Legal Services",
  healthcare: "Healthcare & Wellness",
  logistics: "Logistics & Delivery",
  "home-improvement": "Home Improvement",
  automotive: "Automotive Services",
  "event-planning": "Event Planning",
  "moving-relocation": "Moving & Relocation",
  "pet-care": "Pet Care",
  childcare: "Childcare",
  "elderly-care": "Elderly Care",
  "laundry-drycleaning": "Laundry & Dry Cleaning",
  catering: "Catering & Food Services",
  "real-estate": "Real Estate Services",
  "accounting-tax": "Accounting & Tax",
  "writing-translation": "Writing & Translation",
  "software-development": "Software Development",
  "virtual-assistant": "Virtual Assistant",
  "security-services": "Security Services",
  other: "Other Services",
  // Beauty subcategories — searched on their own far more than the parent "beauty" term
  "nail-tech": "Nail Tech",
  "lash-tech": "Lash Tech",
  "hair-braiding": "Hair Braiding",
  "makeup-artist": "Makeup Artist",
  "hair-styling": "Hair Styling",
  skincare: "Skincare",
  eyebrows: "Eyebrows",
  "massage-spa": "Massage & Spa",
  waxing: "Waxing",
}

const slugify = (value: string) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Real vendor/store data has "FCT", "Abuja", and "Federal Capital Territory" all in use
// for the same place (predates the current state dropdown) — "Abuja" is the canonical
// display name here since that's what people actually search for, but queries match all
// three variants so listings aren't split across them.
const FCT_SLUG_VARIANTS = new Set(['fct', 'abuja', 'federal-capital-territory'])
const FCT_QUERY_ALIASES = ['FCT', 'Abuja', 'Federal Capital Territory']
const FCT_DISPLAY_NAME = 'Abuja'

const STATE_SLUG_TO_NAME: Record<string, string> = Object.fromEntries(
  NIGERIA_STATES
    .filter((name) => !FCT_SLUG_VARIANTS.has(slugify(name)))
    .map((name) => [slugify(name), name])
)

export function resolveStateFromSlug(slug: string): string | null {
  const normalized = slugify(String(slug || ''))
  if (FCT_SLUG_VARIANTS.has(normalized)) return FCT_DISPLAY_NAME
  return STATE_SLUG_TO_NAME[normalized] || null
}

export function slugifyState(name: string): string {
  const normalized = slugify(name)
  return FCT_SLUG_VARIANTS.has(normalized) ? 'abuja' : normalized
}

// Collapses any of the known FCT variants down to one display name so they don't
// fragment into separate (and double-counted) entries when grouping by state.
function normalizeStateDisplayName(rawState: string): string {
  const trimmed = String(rawState || '').trim()
  return FCT_SLUG_VARIANTS.has(slugify(trimmed)) ? FCT_DISPLAY_NAME : trimmed
}

function stateQueryAliases(stateName: string): string[] {
  return stateName === FCT_DISPLAY_NAME ? FCT_QUERY_ALIASES : [stateName]
}

function stateMatchCondition(stateName: string) {
  return { $in: stateQueryAliases(stateName).map((alias) => new RegExp(`^${escapeRegex(alias)}$`, 'i')) }
}

// Product categories are free text (vendors type them, no dropdown) — real data has
// "Health & Beauty", "Home & Garden", etc, not the clean "beauty"/"home" slugs used
// elsewhere in the UI. Resolving against the live distinct values (matched by slug) means
// these pages work against whatever vendors actually typed, instead of silently returning
// nothing for every category that doesn't literally match a curated slug string.
export async function resolveProductCategoryFromSlug(slug: string): Promise<{ dbValue: string; displayName: string } | null> {
  await connectToDatabase()
  const distinctCategories = await Product.distinct('category', { status: 'active' })
  const targetSlug = slugify(String(slug || ''))
  for (const cat of distinctCategories) {
    const catStr = String(cat || '').trim()
    if (catStr && slugify(catStr) === targetSlug) {
      return { dbValue: catStr, displayName: CATEGORY_NAMES[slugify(catStr)] || catStr }
    }
  }
  return null
}

export async function getProductsForCategoryLocation(categoryDbValue: string, stateName: string, limit = 24) {
  await connectToDatabase()

  const stores = await Store.find({ state: stateMatchCondition(stateName) })
    .select('vendorId storeName')
    .lean()
  const vendorIds = (stores as any[]).map((s) => String(s.vendorId)).filter(Boolean)
  if (vendorIds.length === 0) return { products: [], vendorCount: 0 }

  const products = await Product.find({
    vendorId: { $in: vendorIds },
    category: new RegExp(`^${escapeRegex(categoryDbValue)}$`, 'i'),
    status: 'active',
  })
    .sort({ sales: -1, createdAt: -1 })
    .limit(limit)
    .lean()

  return { products, vendorCount: vendorIds.length }
}

export async function getServicesForCategoryLocation(categorySlug: string, stateName: string, limit = 24) {
  await connectToDatabase()

  const services = await ServiceModel.find({
    state: stateMatchCondition(stateName),
    $or: [{ category: categorySlug }, { subcategory: categorySlug }],
    status: 'active',
  })
    .sort({ featured: -1, createdAt: -1 })
    .limit(limit)
    .lean()

  const providerIds = new Set((services as any[]).map((s) => String(s.providerId)))
  return { services, providerCount: providerIds.size }
}

// Which other states have real inventory for this same category — powers the "Shop in
// other cities" cross-links that give search engines a path into these pages at all.
export async function getStatesWithProductInventory(categoryDbValue: string, excludeState: string, limit = 6): Promise<string[]> {
  await connectToDatabase()
  const productVendorIds = await Product.distinct('vendorId', {
    category: new RegExp(`^${escapeRegex(categoryDbValue)}$`, 'i'),
    status: 'active',
  })
  if (productVendorIds.length === 0) return []

  const stores = await Store.find({ vendorId: { $in: productVendorIds } }).select('state').lean()
  const counts = new Map<string, number>()
  for (const store of stores as any[]) {
    const state = normalizeStateDisplayName(store.state)
    if (!state || state.toLowerCase() === excludeState.toLowerCase()) continue
    counts.set(state, (counts.get(state) || 0) + 1)
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([state]) => state)
}

// Real category+state combinations with actual listings — used to link into the
// /book/[category]/[location] pages from somewhere crawlable, since they have no
// generateStaticParams and are otherwise undiscoverable by search engines.
export async function getPopularServiceLandingPages(limit = 8): Promise<Array<{ category: string; categoryName: string; state: string; stateSlug: string; count: number }>> {
  await connectToDatabase()

  const rows = await ServiceModel.aggregate([
    { $match: { status: 'active', state: { $ne: '' } } },
    {
      $addFields: {
        effectiveCategory: {
          $cond: [{ $in: ['$subcategory', [null, '']] }, '$category', '$subcategory'],
        },
      },
    },
    { $group: { _id: { category: '$effectiveCategory', state: '$state' }, count: { $sum: 1 } } },
    { $match: { '_id.category': { $nin: [null, ''] } } },
    { $sort: { count: -1 } },
    { $limit: limit * 3 },
  ])

  const seen = new Set<string>()
  const results: Array<{ category: string; categoryName: string; state: string; stateSlug: string; count: number }> = []
  for (const row of rows as any[]) {
    const category = String(row?._id?.category || '').trim()
    const state = normalizeStateDisplayName(String(row?._id?.state || ''))
    const categoryName = SERVICE_CATEGORY_NAMES[category]
    if (!category || !state || !categoryName) continue
    const key = `${category}::${state}`
    if (seen.has(key)) continue
    seen.add(key)
    results.push({ category, categoryName, state, stateSlug: slugifyState(state), count: row.count })
    if (results.length >= limit) break
  }
  return results
}

// Real category+state combinations with actual listings — used to link into the
// /buy/[category]/[location] pages from somewhere crawlable (Footer), since they have no
// generateStaticParams and are otherwise undiscoverable by search engines.
export async function getPopularProductLandingPages(limit = 8): Promise<Array<{ category: string; categoryName: string; state: string; stateSlug: string; count: number }>> {
  await connectToDatabase()

  const rows = await Product.aggregate([
    { $match: { status: 'active', category: { $ne: null } } },
    { $group: { _id: '$category', vendorIds: { $addToSet: '$vendorId' }, count: { $sum: 1 } } },
  ])

  const results: Array<{ category: string; categoryName: string; state: string; stateSlug: string; count: number }> = []
  for (const row of rows as any[]) {
    const categoryDbValue = String(row?._id || '').trim()
    if (!categoryDbValue) continue
    const categorySlug = slugify(categoryDbValue)
    const categoryName = CATEGORY_NAMES[categorySlug] || categoryDbValue

    const stores = await Store.find({ vendorId: { $in: row.vendorIds } }).select('state').lean()
    const stateCounts = new Map<string, number>()
    for (const store of stores as any[]) {
      const state = normalizeStateDisplayName(store.state)
      if (!state) continue
      stateCounts.set(state, (stateCounts.get(state) || 0) + 1)
    }
    const topState = Array.from(stateCounts.entries()).sort((a, b) => b[1] - a[1])[0]
    if (!topState) continue

    results.push({ category: categorySlug, categoryName, state: topState[0], stateSlug: slugifyState(topState[0]), count: row.count })
  }

  return results.sort((a, b) => b.count - a.count).slice(0, limit)
}

export async function getStatesWithServiceInventory(categorySlug: string, excludeState: string, limit = 6): Promise<string[]> {
  await connectToDatabase()

  const rows = await ServiceModel.aggregate([
    { $match: { $or: [{ category: categorySlug }, { subcategory: categorySlug }], status: 'active' } },
    { $group: { _id: '$state', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ])

  const counts = new Map<string, number>()
  for (const row of rows as any[]) {
    const state = normalizeStateDisplayName(String(row?._id || ''))
    if (!state || state.toLowerCase() === excludeState.toLowerCase()) continue
    counts.set(state, (counts.get(state) || 0) + Number(row.count || 0))
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([state]) => state)
}
