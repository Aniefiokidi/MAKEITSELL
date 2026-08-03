// Photo-based product search — a buyer sends a picture, the bot finds visually similar
// catalog items. Two signals, no AI/vision API involved:
// 1. dHash + Hamming distance (lib/image-hash.ts) — a fast, cheap near-duplicate check
//    (a buyer forwarding/screenshotting a saved product photo). Tried first because it's
//    ~100x cheaper than classification and, when it hits, is almost certainly the answer.
// 2. MobileNet embedding + k-NN category (lib/image-classify.ts, resolveVisualCategoryFor
//    Embedding in lib/product-image-analysis.ts) — used when there's no near-duplicate:
//    narrows to a category by finding the most visually-similar catalog products and
//    voting from their real categories (falling back to a generic ImageNet-label guess
//    only when that vote isn't confident), then ranks everything by embedding similarity.
//    This is what generalizes across "a different photo of a similar-but-not-identical
//    item," which dHash alone cannot do.
//
// Computing the embedding measures ~5-8s/image on this app's pure-JS CPU backend (see
// lib/image-classify.ts's model-choice note) — the entire handler below runs inside
// next/server's after() so it never blocks the webhook's response to Meta, same pattern
// already used for outbound WhatsApp notifications elsewhere in this codebase.
//
// Reuses the same result-presentation pipeline as text search
// (lib/whatsapp/product-results.ts) so paging, captions, and reply-to-select all behave
// identically regardless of how the search started.
import { after } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { Product } from '@/lib/models/Product'
import { WhatsAppBrowseState } from '@/lib/models/WhatsAppBrowseState'
import { sendTextMessage } from '@/lib/whatsapp/client'
import { sendProductResults } from '@/lib/whatsapp/product-results'
import { downloadWhatsAppMedia } from '@/lib/whatsapp/media'
import { computeImageHashFromBuffer, hammingDistance } from '@/lib/image-hash'
import { computeEmbeddingFromBuffer, cosineSimilarity } from '@/lib/image-classify'
import { resolveVisualCategoryForEmbedding } from '@/lib/product-image-analysis'
import { BLOCKING_CHECKOUT_STAGES } from '@/lib/whatsapp/checkout'

const RESULTS_PER_PAGE = 4
// Tight — reserved for near-duplicates. The old, looser dHash-only threshold (12) is
// what used to be relied on for "similar" matches too, which is exactly what dHash is
// unreliable at; that job now belongs to embedding similarity below.
const NEAR_DUPLICATE_HAMMING_DISTANCE = 6
// Cosine similarity floor for "similar enough to show". Not tuned against this catalog's
// real photos yet — a starting heuristic, like the dHash threshold was, likely to need
// adjusting once there's real usage data.
const MIN_EMBEDDING_SIMILARITY = 0.4

async function trySendText(waId: string, body: string): Promise<void> {
  try {
    await sendTextMessage(waId, body)
  } catch (error) {
    console.error(`[whatsapp-image-search] Text send failed for ${waId}:`, error)
  }
}

// Fetches every active, hashed product and scores it in application code — MongoDB has
// no native Hamming-distance index. Fine at this catalog's current size; would need a
// proper index (or a capped candidate set) if the active catalog grows much larger.
async function findNearDuplicate(hash: string): Promise<any | null> {
  await connectToDatabase()
  const candidates = await Product.find({ status: 'active', imageHash: { $exists: true, $ne: null } })
    .select('name price images vendorName storeId imageHash')
    .lean()

  let best: { product: any; distance: number } | null = null
  for (const product of candidates as any[]) {
    const distance = hammingDistance(hash, String((product as any).imageHash || ''))
    if (distance <= NEAR_DUPLICATE_HAMMING_DISTANCE && (!best || distance < best.distance)) {
      best = { product, distance }
    }
  }
  return best?.product || null
}

// Same "score everything in application code" caveat as findNearDuplicate — no native
// vector index. `category` is the ALREADY-DECIDED filter (or null for "search all"),
// passed in rather than re-derived, so "more" paging (which reuses this with the same
// category) doesn't need to re-run classification.
async function findEmbeddingMatches(
  embedding: number[],
  category: string | null,
  offset: number
): Promise<{ pageItems: any[]; hasMore: boolean }> {
  await connectToDatabase()

  const baseQuery: any = { status: 'active', imageEmbedding: { $exists: true, $ne: [] } }
  const query = category ? { ...baseQuery, visualCategory: category } : baseQuery

  let candidates = await Product.find(query)
    .select('name price images vendorName storeId imageEmbedding')
    .lean()

  // A category filter that happens to match nothing in the catalog shouldn't dead-end
  // the search — fall back to ranking across everything instead.
  if (candidates.length === 0 && category) {
    candidates = await Product.find(baseQuery).select('name price images vendorName storeId imageEmbedding').lean()
  }

  const scored = (candidates as any[])
    .map((product) => ({ product, similarity: cosineSimilarity(embedding, (product as any).imageEmbedding || []) }))
    .filter((entry) => entry.similarity >= MIN_EMBEDDING_SIMILARITY)
    .sort((a, b) => b.similarity - a.similarity)

  const pageItems = scored.slice(offset, offset + RESULTS_PER_PAGE).map((entry) => entry.product)
  const hasMore = scored.length > offset + RESULTS_PER_PAGE
  return { pageItems, hasMore }
}

// Shared by the initial embedding-based match and "more" paging (buyer.ts's
// handleMoreCommand, when browse state's matchMode is 'embedding').
export async function runEmbeddingMatchAndReply(
  waId: string,
  embedding: number[],
  category: string | null,
  offset: number
): Promise<void> {
  const { pageItems, hasMore } = await findEmbeddingMatches(embedding, category, offset)

  if (pageItems.length === 0) {
    console.log(`[whatsapp-image-search] no embedding matches (category ${category || 'any'}, offset ${offset}) — ${waId}`)
    await trySendText(
      waId,
      offset > 0
        ? 'No more visual matches for that photo.'
        : "Couldn't find a close visual match for that photo in our catalog. Try describing what you're looking for in words instead, or type \"categories\" to browse."
    )
    return
  }

  console.log(`[whatsapp-image-search] sending ${pageItems.length} embedding match(es) (category ${category || 'any'}, offset ${offset}, hasMore ${hasMore}) — ${waId}`)

  await Promise.all([
    sendProductResults(waId, pageItems),
    WhatsAppBrowseState.findOneAndUpdate(
      { waId },
      {
        $set: {
          matchMode: 'embedding',
          lastImageEmbedding: embedding,
          lastVisualCategory: category,
          offset: offset + pageItems.length,
          updatedAt: new Date(),
        },
        $unset: { lastQuery: '', lastImageHash: '' },
      },
      { upsert: true }
    ),
  ])

  if (hasMore) {
    await trySendText(waId, 'Reply "more" to see more matches for that photo.')
  }
}

// "more" paging for a near-duplicate hit — rare (there's normally exactly one near-exact
// match), but handled the same way as the dHash-only version used to for consistency.
export async function runNearDuplicateMoreAndReply(waId: string, hash: string, offset: number): Promise<void> {
  await connectToDatabase()
  const candidates = await Product.find({ status: 'active', imageHash: { $exists: true, $ne: null } })
    .select('name price images vendorName storeId imageHash')
    .lean()

  const scored = (candidates as any[])
    .map((product) => ({ product, distance: hammingDistance(hash, String((product as any).imageHash || '')) }))
    .filter((entry) => entry.distance <= NEAR_DUPLICATE_HAMMING_DISTANCE)
    .sort((a, b) => a.distance - b.distance)

  const pageItems = scored.slice(offset, offset + RESULTS_PER_PAGE).map((entry) => entry.product)
  if (pageItems.length === 0) {
    await trySendText(waId, 'No more visual matches for that photo.')
    return
  }

  const hasMore = scored.length > offset + pageItems.length
  await Promise.all([
    sendProductResults(waId, pageItems),
    WhatsAppBrowseState.findOneAndUpdate(
      { waId },
      { $set: { offset: offset + pageItems.length, updatedAt: new Date() } },
      { upsert: true }
    ),
  ])
  if (hasMore) {
    await trySendText(waId, 'Reply "more" to see more matches for that photo.')
  }
}

// Called from buyer.ts's handleMoreCommand once browse state resolves matchMode.
export async function continueImageMatchPaging(waId: string, state: any): Promise<void> {
  const offset = Number(state?.offset || 0)
  if (state?.matchMode === 'duplicate' && state?.lastImageHash) {
    await runNearDuplicateMoreAndReply(waId, state.lastImageHash, offset)
    return
  }
  if (state?.matchMode === 'embedding' && Array.isArray(state?.lastImageEmbedding)) {
    await runEmbeddingMatchAndReply(waId, state.lastImageEmbedding, state.lastVisualCategory ?? null, offset)
  }
}

async function processBuyerImage(waId: string, mediaId: string): Promise<void> {
  await connectToDatabase()
  const state: any = await WhatsAppBrowseState.findOne({ waId }).lean()
  const stage = String(state?.stage || 'browsing')
  if (BLOCKING_CHECKOUT_STAGES.has(stage)) {
    await trySendText(waId, 'You\'re in the middle of checkout — please finish that first (or reply "cancel" to start over) before sending a photo.')
    return
  }

  const media = await downloadWhatsAppMedia(mediaId)
  if (!media) {
    await trySendText(waId, "Sorry, I couldn't download that photo — please try sending it again.")
    return
  }

  const hash = await computeImageHashFromBuffer(media.buffer)
  const nearDuplicate = hash ? await findNearDuplicate(hash) : null

  if (nearDuplicate) {
    console.log(`[whatsapp-image-search] near-duplicate hit for ${waId}`)
    await Promise.all([
      sendProductResults(waId, [nearDuplicate]),
      WhatsAppBrowseState.findOneAndUpdate(
        { waId },
        {
          $set: { matchMode: 'duplicate', lastImageHash: hash, offset: 1, updatedAt: new Date() },
          $unset: { lastQuery: '', lastImageEmbedding: '', lastVisualCategory: '' },
        },
        { upsert: true }
      ),
    ])
    return
  }

  const embedding = await computeEmbeddingFromBuffer(media.buffer)
  if (!embedding) {
    await trySendText(waId, "Sorry, I couldn't process that photo. Try a different one, or search by typing a product name.")
    return
  }

  // Same k-NN-primary, ImageNet-fallback resolution used for product tagging (see
  // lib/product-image-analysis.ts) — no excludeProductId, the buyer's photo isn't itself
  // a catalog product.
  const category = await resolveVisualCategoryForEmbedding(embedding, media.buffer)
  await runEmbeddingMatchAndReply(waId, embedding, category, 0)
}

// Entry point for an inbound image message from a non-linked (buyer) sender — called
// from lib/whatsapp/commands.ts's handleInboundImageMessage. Wraps the whole pipeline in
// after() and returns immediately: classification alone can take several seconds, and
// this must never be what the webhook's response to Meta waits on.
export function handleBuyerImageMessage(waId: string, mediaId: string): void {
  after(async () => {
    try {
      await processBuyerImage(waId, mediaId)
    } catch (error) {
      console.error(`[whatsapp-image-search] Unhandled error processing image for ${waId}:`, error)
    }
  })
}
