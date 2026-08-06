// Background image analysis for products — computes the dHash (near-duplicate matching,
// lib/image-hash.ts), MobileNet embedding (lib/image-classify.ts), and a visual category
// for a product's first photo, AFTER the create/update response has already gone back to
// the vendor. Classification measures ~5-8s per image (embedding-only forward pass) on
// this app's pure-JS CPU backend — running it inline in createProduct/updateProduct would
// make every product save feel broken. The product is created/updated (searchable,
// buyable) immediately; these fields populate a few seconds later via next/server's
// after(), same pattern already used for outbound WhatsApp notifications elsewhere in
// this codebase. A buyer's WhatsApp photo search simply skips any product whose analysis
// hasn't landed yet (see lib/whatsapp/image-search.ts's candidate query).
//
// Category source: PRIMARILY k-NN against the catalog's own vendor-entered `category`
// field (voteCategoryFromNeighbors below), using embeddings already computed for every
// other product — falls back to the generic ImageNet-keyword mapping
// (classifyImageNetFromBuffer's visualCategory) only when k-NN has no confident answer.
// k-NN measurably outperforms the ImageNet mapping for product types ImageNet has no good
// class for (perfume bottles, hair-care items came up repeatedly in testing) because it's
// calibrated against this catalog's own real photos and real category labels, not generic
// unrelated ImageNet semantics — and because it uses the full embedding vector (a rich,
// continuous signal) rather than collapsing to one discrete top-1 label guess.
//
// The ImageNet fallback is a SECOND forward pass (see image-classify.ts) — deliberately
// only run for the rare product k-NN can't resolve, not unconditionally for every image.
import { after } from 'next/server'
import connectToDatabase from './mongodb'
import { Product as ProductModel } from './models/Product'
import { computeImageHashFromBuffer } from './image-hash'
import { computeEmbeddingFromBuffer, classifyImageNetFromBuffer, cosineSimilarity } from './image-classify'

interface ProductImageAnalysis {
  imageHash: string | null
  visualCategory: string | null
  imageEmbedding: number[] | null
}

const KNN_NEIGHBORS = 5
// Winning category's share of similarity-weighted votes among the k neighbors, needed to
// trust the k-NN result as the product's category. Empirically validated, not just a
// guess: a full backfill run at this exact bar measured 72/90 exact matches (80%) against
// the catalog's own real, vendor-entered categories, correctly recovering every
// previously-known-bad case (perfume bottles, hair-care items misread by the generic
// ImageNet mapping). Exported so the admin backfill's phase 2 (which votes via
// voteCategoryFromNeighbors directly, not through resolveVisualCategoryForEmbedding)
// applies the exact same bar.
export const MIN_KNN_VOTE_SHARE = 0.4
// Fallback bar for the generic ImageNet-keyword mapping, only used when k-NN above found
// nothing confident enough (~6% of products in the last backfill). Low-traffic path — not
// worth the same depth of tuning as the primary k-NN signal above.
const MIN_IMAGENET_CONFIDENCE = 0.2

export interface CategoryNeighbor {
  category: string
  embedding: number[]
}

// Pure, no DB access — given a precomputed neighbor list, does the similarity-weighted
// majority vote. Split out from predictCategoryFromCatalog (which fetches that list from
// the DB) so a caller processing many products in one pass (the admin backfill) can build
// the neighbor list ONCE in memory and vote for every product against it, rather than
// re-querying the database per product.
export function voteCategoryFromNeighbors(
  embedding: number[],
  neighbors: CategoryNeighbor[]
): { category: string | null; confidence: number } {
  const scored = neighbors
    .map((n) => ({ category: n.category, similarity: cosineSimilarity(embedding, n.embedding) }))
    .filter((entry) => entry.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, KNN_NEIGHBORS)

  if (scored.length === 0) return { category: null, confidence: 0 }

  const votes = new Map<string, number>()
  let totalWeight = 0
  for (const entry of scored) {
    votes.set(entry.category, (votes.get(entry.category) || 0) + entry.similarity)
    totalWeight += entry.similarity
  }

  let bestCategory: string | null = null
  let bestWeight = 0
  for (const [category, weight] of votes) {
    if (weight > bestWeight) {
      bestWeight = weight
      bestCategory = category
    }
  }

  return { category: bestCategory, confidence: totalWeight > 0 ? bestWeight / totalWeight : 0 }
}

function isKnnConfident(knn: { category: string | null; confidence: number }): boolean {
  return Boolean(knn.category) && knn.confidence >= MIN_KNN_VOTE_SHARE
}

// Finds the K most visually-similar OTHER products (by embedding cosine similarity) and
// votes from their real, vendor-entered `category` values. A DB query per call — fine for
// one-off callers (single-product create/update, a buyer's WhatsApp photo); the admin
// backfill instead builds its neighbor list once and calls voteCategoryFromNeighbors
// directly for every product, to avoid N queries.
export async function predictCategoryFromCatalog(embedding: number[], excludeProductId?: string): Promise<{ category: string | null; confidence: number }> {
  await connectToDatabase()

  const query: any = {
    status: 'active',
    imageEmbedding: { $exists: true, $ne: [] },
    category: { $exists: true, $ne: null },
  }
  if (excludeProductId) query._id = { $ne: excludeProductId }

  const candidates = await ProductModel.find(query).select('category imageEmbedding').lean()
  const neighbors: CategoryNeighbor[] = (candidates as any[]).map((c) => ({
    category: String(c.category),
    embedding: c.imageEmbedding || [],
  }))
  return voteCategoryFromNeighbors(embedding, neighbors)
}

// The shared "k-NN primary, ImageNet fallback only if needed" resolution — used by both
// the single-product analyze path below and a buyer's WhatsApp photo search
// (lib/whatsapp/image-search.ts), so the same category logic backs both product tagging
// and search-time category filtering. `buffer` is only actually decoded/run through the
// model if the k-NN vote isn't confident enough on its own.
export async function resolveVisualCategoryForEmbedding(
  embedding: number[],
  buffer: Buffer,
  excludeProductId?: string
): Promise<string | null> {
  const knn = await predictCategoryFromCatalog(embedding, excludeProductId)
  if (isKnnConfident(knn)) return knn.category

  const imagenet = await classifyImageNetFromBuffer(buffer)
  if (imagenet?.visualCategory && imagenet.categoryConfidence >= MIN_IMAGENET_CONFIDENCE) {
    return imagenet.visualCategory
  }
  return null
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.error(`[product-image-analysis] Failed to fetch image: ${url} (${res.status})`)
      return null
    }
    return Buffer.from(await res.arrayBuffer())
  } catch (error) {
    console.error(`[product-image-analysis] Failed to fetch image: ${url}`, error)
    return null
  }
}

async function analyzeImage(url: string, excludeProductId?: string): Promise<ProductImageAnalysis | null> {
  const buffer = await fetchImageBuffer(url)
  if (!buffer) return null

  const [imageHash, embedding] = await Promise.all([
    computeImageHashFromBuffer(buffer),
    computeEmbeddingFromBuffer(buffer),
  ])

  const visualCategory = embedding
    ? await resolveVisualCategoryForEmbedding(embedding, buffer, excludeProductId)
    : null

  return { imageHash: imageHash ?? null, visualCategory, imageEmbedding: embedding }
}

export function scheduleProductImageAnalysis(productId: string, imageUrl: string): void {
  if (!productId || !imageUrl) return

  after(async () => {
    const analysis = await analyzeImage(imageUrl, productId)
    if (!analysis) return

    const setFields: Record<string, any> = {}
    if (analysis.imageHash) setFields.imageHash = analysis.imageHash
    if (analysis.visualCategory) setFields.visualCategory = analysis.visualCategory
    if (analysis.imageEmbedding) setFields.imageEmbedding = analysis.imageEmbedding
    if (Object.keys(setFields).length === 0) return

    try {
      await connectToDatabase()
      await ProductModel.updateOne({ _id: productId }, { $set: setFields })
      console.log(`[product-image-analysis] Analyzed product ${productId}: category=${analysis.visualCategory || 'none'}`)
    } catch (error) {
      console.error(`[product-image-analysis] Failed to persist analysis for product ${productId}:`, error)
    }
  })
}

interface HashAndEmbedding {
  imageHash: string | null
  imageEmbedding: number[] | null
}

// Admin backfill phase 1 (app/api/admin/backfill-image-hashes) — hash + embedding only,
// one forward pass, no k-NN/DB/ImageNet work yet. The route runs this for every product
// first, then votes categories in a second, fast, in-memory pass once every embedding is
// on the same dimension (matters when the model itself has just changed), then a third
// pass calls classifyImageNetFallbackSync below ONLY for products that pass 2 couldn't
// confidently vote a category for.
export async function computeProductHashAndEmbeddingSync(url: string): Promise<HashAndEmbedding | null> {
  const buffer = await fetchImageBuffer(url)
  if (!buffer) return null
  const [imageHash, imageEmbedding] = await Promise.all([
    computeImageHashFromBuffer(buffer),
    computeEmbeddingFromBuffer(buffer),
  ])
  return { imageHash: imageHash ?? null, imageEmbedding }
}

// Admin backfill phase 3 — re-fetches the image (cheap; the expensive part is the model
// forward pass, not the download) to run the ImageNet fallback classification for the
// small subset phase 2's k-NN vote couldn't confidently resolve.
export async function classifyImageNetFallbackSync(url: string): Promise<string | null> {
  const buffer = await fetchImageBuffer(url)
  if (!buffer) return null
  const imagenet = await classifyImageNetFromBuffer(buffer)
  if (imagenet?.visualCategory && imagenet.categoryConfidence >= MIN_IMAGENET_CONFIDENCE) {
    return imagenet.visualCategory
  }
  return null
}
