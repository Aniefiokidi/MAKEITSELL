// Photo-based product search — a buyer sends a picture, the bot finds visually similar
// catalog items. Three signals, no AI/vision API involved:
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
// 3. OCR fallback (lib/image-ocr.ts) — only when 1 and 2 both find nothing. Reads any
//    text in the photo (a screenshot of a listing with a visible product name/price, a
//    flyer) and runs it as an ordinary text search. This is genuinely different from
//    visual similarity — it can't answer "what's in this photo," it can only find text
//    that happens to be printed in it.
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
import { getProducts } from '@/lib/mongodb-operations'
import { WhatsAppBrowseState } from '@/lib/models/WhatsAppBrowseState'
import { sendTextMessage } from '@/lib/whatsapp/client'
import { sendProductResults } from '@/lib/whatsapp/product-results'
import { downloadWhatsAppMedia } from '@/lib/whatsapp/media'
import { computeImageHashFromBuffer, hammingDistance } from '@/lib/image-hash'
import { computeEmbeddingFromBuffer, cosineSimilarity } from '@/lib/image-classify'
import { extractTextFromImage } from '@/lib/image-ocr'
import { resolveVisualCategoryForEmbedding } from '@/lib/product-image-analysis'
import { BLOCKING_CHECKOUT_STAGES } from '@/lib/whatsapp/checkout'

const RESULTS_PER_PAGE = 4
// Empirically validated against the real catalog (95 products, 4,465 distinct-product
// pairs): the CLOSEST any two genuinely different products ever get is Hamming distance
// 14 — nothing comes close to a lower threshold by accident. Raised from an initial guess
// of 6 to 10, keeping a 4-distance safety margin below that observed floor while giving
// real-world buyer photos (which carry more recompression/framing noise than these clean
// catalog images) more room to still register as the same item.
const NEAR_DUPLICATE_HAMMING_DISTANCE = 10
// Empirically corrected: an initial guess of 0.4 turned out to reject the MAJORITY of
// genuine matches — measured directly against the real catalog, same-category product
// pairs have a median cosine similarity of only 0.366 (75th percentile 0.425), so 0.4 was
// filtering out roughly three-quarters of legitimately similar items, not just the noise
// it was meant to catch. Lowered to 0.30 (near the catalog-wide median), trading a bit of
// precision for the recall this feature actually needs — a loosely-related result ranked
// low is far better UX than a real match silently discarded.
const MIN_EMBEDDING_SIMILARITY = 0.3

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

// Sends an already-resolved page of embedding matches and updates paging state — split
// out from runEmbeddingMatchAndReply so processBuyerImage's initial search (which needs
// to inspect pageItems BEFORE deciding whether to fall to OCR) and the "more"/direct-hit
// paths can share the same send+state logic without a redundant second query.
async function presentEmbeddingMatches(
  waId: string,
  embedding: number[],
  category: string | null,
  offset: number,
  pageItems: any[],
  hasMore: boolean
): Promise<void> {
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

// Shared by "more" paging (buyer.ts's handleMoreCommand, when browse state's matchMode is
// 'embedding') and any direct embedding-match call that doesn't need OCR-fallback logic.
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

  await presentEmbeddingMatches(waId, embedding, category, offset, pageItems, hasMore)
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

// OCR-fallback results are presented as an ordinary text search — sets lastQuery (not
// matchMode) so a later "more" naturally continues via buyer.ts's existing text-search
// paging, with zero special-casing needed there.
async function sendOcrFallbackResults(waId: string, extractedText: string): Promise<boolean> {
  const products = await getProducts({ search: extractedText, status: 'active', limitCount: RESULTS_PER_PAGE + 1 })
  if (products.length === 0) return false

  const hasMore = products.length > RESULTS_PER_PAGE
  const pageItems = products.slice(0, RESULTS_PER_PAGE)

  console.log(`[whatsapp-image-search] OCR fallback: found ${pageItems.length} result(s) for extracted text "${extractedText}" — ${waId}`)

  await Promise.all([
    sendProductResults(waId, pageItems),
    WhatsAppBrowseState.findOneAndUpdate(
      { waId },
      {
        $set: { lastQuery: extractedText, offset: pageItems.length, updatedAt: new Date() },
        $unset: { matchMode: '', lastImageHash: '', lastImageEmbedding: '', lastVisualCategory: '' },
      },
      { upsert: true }
    ),
  ])

  await trySendText(waId, `Didn't find a close visual match, but spotted "${extractedText}" written on the photo — here's what matched that.${hasMore ? ' Reply "more" to see more.' : ''}`)
  return true
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
  const { pageItems, hasMore } = await findEmbeddingMatches(embedding, category, 0)

  if (pageItems.length > 0) {
    await presentEmbeddingMatches(waId, embedding, category, 0, pageItems, hasMore)
    return
  }

  // Visual similarity found nothing — before giving up, check whether there's any
  // legible text IN the photo (a screenshot of a listing, a flyer) and try that as a
  // plain text search. Genuinely different capability from visual matching: this can
  // only find text that's actually printed in the image, not "what the photo shows."
  const extractedText = await extractTextFromImage(media.buffer).catch((error) => {
    console.error(`[whatsapp-image-search] OCR fallback failed for ${waId}:`, error)
    return null
  })
  if (extractedText) {
    const found = await sendOcrFallbackResults(waId, extractedText)
    if (found) return
  }

  console.log(`[whatsapp-image-search] no embedding or OCR matches — ${waId}`)
  await trySendText(waId, "Couldn't find a close visual match for that photo in our catalog. Try describing what you're looking for in words instead, or type \"categories\" to browse.")
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
