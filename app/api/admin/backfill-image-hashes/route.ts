import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { Product } from '@/lib/models/Product'
import { requireCronOrAdminAccess } from '@/lib/server-route-auth'
import {
  computeProductHashAndEmbeddingSync,
  voteCategoryFromNeighbors,
  classifyImageNetFallbackSync,
  MIN_KNN_VOTE_SHARE,
  type CategoryNeighbor,
} from '@/lib/product-image-analysis'

// One-time-per-product migration, safe to re-run any time (e.g. after a bulk import, or
// if the model/mapping ever changes) — by default only touches products missing at least
// one of the three analysis fields, so an already-fully-analyzed product is never
// re-fetched. Pass ?force=true to reprocess every product regardless (e.g. after switching
// the MobileNet model/tuning the category mapping in lib/image-classify.ts).
//
// Three phases, deliberately in this order:
// 1. Hash + embedding for every product needing it (one forward pass/image — the
//    expensive part). Category is NOT voted yet: k-NN needs every OTHER product's
//    embedding already computed and on the same dimension, which isn't true mid-phase
//    when embeddings are being (re)computed catalog-wide.
// 2. Vote every analyzed product's category from the now-complete, consistent in-memory
//    embedding set — fast (just vector math), no re-fetching or re-classifying images.
// 3. Only for the (typically small) subset phase 2 couldn't confidently vote a category
//    for: re-fetch and run the generic ImageNet-label classifier as a fallback (a SECOND
//    forward pass, paid for only here, not for every product) — see
//    lib/product-image-analysis.ts's module comment for why this ordering roughly halves
//    total backfill time compared to always running both forward passes.
async function runBackfill(force: boolean) {
  const filter: any = { images: { $exists: true, $ne: [] } }
  if (!force) {
    filter.$or = [
      { imageHash: { $exists: false } },
      { visualCategory: { $exists: false } },
      { imageEmbedding: { $exists: false } },
    ]
  }

  const products = await Product.find(filter, { _id: 1, images: 1 }).lean() as any[]

  let failed = 0
  const analyzedIds: string[] = []

  for (const product of products) {
    const firstImage = Array.isArray(product.images) ? product.images[0] : undefined
    if (!firstImage) continue

    const raw = await computeProductHashAndEmbeddingSync(firstImage)
    if (!raw?.imageEmbedding) {
      failed++
      continue
    }

    const setFields: Record<string, any> = { imageEmbedding: raw.imageEmbedding }
    if (raw.imageHash) setFields.imageHash = raw.imageHash
    await Product.updateOne({ _id: product._id }, { $set: setFields })
    analyzedIds.push(String(product._id))
  }

  // Reference set for phase 2 votes: every product in the CATALOG with a real category —
  // not just the ones just (re)analyzed, so a full-catalog force run still has itself as
  // its own reference (each entry excludes only its own id when voting, below).
  const allCategorized = await Product.find(
    { status: 'active', imageEmbedding: { $exists: true, $ne: [] }, category: { $exists: true, $ne: null } },
    { category: 1, imageEmbedding: 1 }
  ).lean() as any[]

  const needsFallback: string[] = []
  let updated = 0

  for (const id of analyzedIds) {
    const self: any = allCategorized.find((c) => String(c._id) === id)
    if (!self?.imageEmbedding) continue

    const neighbors: CategoryNeighbor[] = allCategorized
      .filter((c) => String(c._id) !== id)
      .map((c) => ({ category: String(c.category), embedding: c.imageEmbedding || [] }))

    const knn = voteCategoryFromNeighbors(self.imageEmbedding, neighbors)

    if (knn.category && knn.confidence >= MIN_KNN_VOTE_SHARE) {
      await Product.updateOne({ _id: id }, { $set: { visualCategory: knn.category } })
      updated++
    } else {
      needsFallback.push(id)
    }
  }

  // Phase 3 — the small remainder, one extra forward pass each.
  for (const id of needsFallback) {
    const product: any = await Product.findById(id).select('images').lean()
    const firstImage = Array.isArray(product?.images) ? product.images[0] : undefined
    const fallbackCategory = firstImage ? await classifyImageNetFallbackSync(firstImage) : null

    if (fallbackCategory) {
      await Product.updateOne({ _id: id }, { $set: { visualCategory: fallbackCategory } })
    } else {
      await Product.updateOne({ _id: id }, { $unset: { visualCategory: '' } })
    }
    updated++
  }

  return { scanned: products.length, updated, failed, usedImagenetFallback: needsFallback.length }
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireCronOrAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    await connectToDatabase()
    const force = new URL(request.url).searchParams.get('force') === 'true'
    const summary = await runBackfill(force)
    return NextResponse.json({ success: true, summary })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Backfill failed' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
