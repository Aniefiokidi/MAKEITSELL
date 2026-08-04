// Buyer-facing WhatsApp flow — product search/browsing, cart, and checkout for an
// UNLINKED sender (i.e. not a linked vendor, see resolveLinkedVendor in
// lib/whatsapp/commands.ts). Every product read goes through the existing getProducts()
// (lib/mongodb-operations.ts) with status: 'active' explicitly passed, so this never
// surfaces inactive/out-of-stock inventory. Cart/checkout logic itself lives in
// lib/whatsapp/checkout.ts — this file is the router that decides whether a message is
// browsing/search or a checkout action.
import connectToDatabase from '@/lib/mongodb'
import { getProducts } from '@/lib/mongodb-operations'
import { WhatsAppBrowseState } from '@/lib/models/WhatsAppBrowseState'
import { sendTextMessage, sendInteractiveListMessage, type WhatsAppListRow } from '@/lib/whatsapp/client'
import { PRODUCT_CATEGORIES } from '@/lib/product-categories'
import { sendProductResults } from '@/lib/whatsapp/product-results'
import {
  BLOCKING_CHECKOUT_STAGES,
  tryHandleProductReply,
  tryHandleCommaSeparatedAdd,
  sendCartSummary,
  handleRemoveCommand,
  handleCheckoutStart,
  handleCancelCommand,
  handleCheckoutStageMessage,
} from '@/lib/whatsapp/checkout'

const RESULTS_PER_PAGE = 4
// Fetch one extra beyond the display page so "are there more results" can be answered
// from this one query instead of a separate count query.
const FETCH_PER_PAGE = RESULTS_PER_PAGE + 1
// Meta's interactive list hard cap is 10 rows total across all sections combined.
const MAX_LIST_ROWS = 10

// Deliberately an explicit, exact-match list — NOT a fuzzy/substring check. A buyer
// typing a product name (e.g. "hair", "how much for iPhone") must always reach search,
// never get misfired into a greeting reply. When in doubt, it's a search.
const GREETING_KEYWORDS = new Set([
  'hi', 'hello', 'hey', 'hiya', 'howdy', 'yo', 'start', 'help',
  'good morning', 'good afternoon', 'good evening', 'gm',
  'howfar', 'how far', 'how far now',
  'wetin dey', 'wetin dey happen', 'wetin dey sup', 'wetin sup',
  'abeg', 'wassup', 'whats up', "what's up", 'sup',
])
const CATEGORY_KEYWORDS = new Set(['menu', 'categories', 'category'])
// Now doubles as a checkout trigger (see handleBuyerMessage) rather than a coming-soon
// placeholder — ordering is live. Still conservative: only short messages, so a longer
// legitimate product search containing one of these words isn't misrouted.
const BUY_INTENT_PATTERN = /\b(buy|purchase|checkout|order)\b/i
const BUY_INTENT_MAX_LENGTH = 40
const REMOVE_PATTERN = /^remove\s+(\d+)$/
// Broadened from an exact "cart" match after real buyers asked "what is in my cart",
// "show my cart", and Pidgin phrasing like "wetin dey inside my cart" — none of which
// matched the old exact-keyword check and fell through to a failed product search
// instead. "cart" as a whole word is a strong, low-risk signal for this catalog (no
// product category here is likely to be literally named "cart"), so a plain substring/
// word-boundary match is a reasonable trade-off without adding an NLU layer.
const CART_VIEW_PATTERN = /\bcart\b/i

// Mostly clear English with a light Pidgin touch ("how far") rather than full Pidgin
// throughout — warm and local without reading as a caricature or excluding buyers who
// don't speak Pidgin. Doubles as onboarding: a first-time buyer has no idea what to type,
// so this plainly spells out the three things they can actually do.
const GREETING_MESSAGE =
  'Hey, how far! I\'m the Make It Sell shopping bot.\n\nHere\'s how to use me:\n- Type a product name to search (e.g. "sneakers")\n- Reply "categories" to browse by category\n- Reply "more" to see more results\n\nWhat are you looking for today?'

// Every reply goes through one of these so a delivery failure never throws back up into
// the webhook handler — matches the trySend discipline in lib/whatsapp/commands.ts.
async function trySendText(waId: string, body: string): Promise<void> {
  try {
    await sendTextMessage(waId, body)
  } catch (error) {
    console.error(`[whatsapp-buyer] Text send failed for ${waId}:`, error)
  }
}

async function trySendList(waId: string, bodyText: string, buttonText: string, rows: WhatsAppListRow[]): Promise<void> {
  try {
    await sendInteractiveListMessage(waId, bodyText, buttonText, rows)
  } catch (error) {
    console.error(`[whatsapp-buyer] List send failed for ${waId}:`, error)
  }
}

// Runs a product search (free text or a category name) and sends up to RESULTS_PER_PAGE
// results as image+caption messages, persisting paging state so a later "more" picks up
// where this left off. `offset` is the number of results already shown for this query.
async function runSearchAndReply(waId: string, query: string, offset: number): Promise<void> {
  await connectToDatabase()

  const products = await getProducts({
    search: query,
    status: 'active',
    limitCount: FETCH_PER_PAGE,
    skipCount: offset,
  })

  if (products.length === 0) {
    console.log(`[whatsapp-buyer] search: no results for "${query}" (offset ${offset}) — ${waId}`)
    await trySendText(
      waId,
      offset > 0
        ? `No more results for "${query}".`
        : `No products found for "${query}". Try a different search, or type "categories" to browse.`
    )
    return
  }

  const hasMore = products.length > RESULTS_PER_PAGE
  const pageItems = products.slice(0, RESULTS_PER_PAGE)

  console.log(`[whatsapp-buyer] search: sending ${pageItems.length} result(s) for "${query}" (offset ${offset}, hasMore ${hasMore}) — ${waId}`)

  // Fire all result sends and the browse-state write concurrently instead of one at a
  // time — each send is a real network round-trip to Meta's API, so awaiting them
  // sequentially was the dominant source of the bot's reply latency (up to 4 back-to-
  // back round-trips before the buyer saw the last image). Individual sends already
  // catch their own errors, so one failure can't fail this Promise.all or block the
  // others. Minor trade-off: results can now arrive on the buyer's phone in a slightly
  // different order than pageItems — acceptable for a burst of results.
  // $unset clears any in-progress image-search paging state — this is a text search,
  // so "more" from here on should continue paging THIS query, not a stale photo match.
  await Promise.all([
    sendProductResults(waId, pageItems),
    WhatsAppBrowseState.findOneAndUpdate(
      { waId },
      {
        $set: { lastQuery: query, offset: offset + pageItems.length, updatedAt: new Date() },
        $unset: { matchMode: '', lastImageHash: '', lastImageEmbedding: '', lastVisualCategory: '' },
      },
      { upsert: true }
    ),
  ])

  if (hasMore) {
    await trySendText(waId, `Reply "more" to see more results for "${query}".`)
  }
}

async function handleMoreCommand(waId: string): Promise<void> {
  await connectToDatabase()
  const state: any = await WhatsAppBrowseState.findOne({ waId }).lean()

  if (state?.matchMode) {
    // Dynamic import — image-search.ts pulls in TensorFlow.js (via lib/image-classify.ts),
    // which must not be a load-time dependency of this whole file (buyer.ts is imported by
    // lib/whatsapp/commands.ts, itself imported by the webhook route hit by EVERY inbound
    // message). Only actually loaded when a buyer is paging through image-search results.
    const { continueImageMatchPaging } = await import('@/lib/whatsapp/image-search')
    await continueImageMatchPaging(waId, state)
    return
  }

  if (!state?.lastQuery) {
    console.log(`[whatsapp-buyer] more: no prior search for ${waId}`)
    await trySendText(waId, 'Nothing to continue — search for a product by typing its name, or type "categories" to browse.')
    return
  }
  await runSearchAndReply(waId, state.lastQuery, Number(state.offset || 0))
}

async function sendCategoryMenu(waId: string): Promise<void> {
  const rows: WhatsAppListRow[] = PRODUCT_CATEGORIES.slice(0, MAX_LIST_ROWS).map((category) => ({
    id: `category:${category.slug}`,
    title: category.name.slice(0, 24),
    description: category.description.slice(0, 72),
  }))
  await trySendList(waId, 'Browse by category:', 'Categories', rows)
}

// Handles a tap on the category list sent by sendCategoryMenu. `rowId` is the id we set
// above ("category:<slug>"). There's no separate category filter in the product data
// model, so this is effectively a search by the category's display name — same
// presentation path as a typed text search.
export async function handleCategorySelection(waId: string, rowId: string): Promise<void> {
  const slug = String(rowId || '').replace(/^category:/, '')
  const category = PRODUCT_CATEGORIES.find((c) => c.slug === slug)
  if (!category) {
    console.log(`[whatsapp-buyer] category selection: unknown row id "${rowId}" from ${waId}`)
    await trySendText(waId, "Couldn't find that category. Type \"categories\" to see the list again.")
    return
  }
  console.log(`[whatsapp-buyer] category selection: ${waId} -> ${category.slug}`)
  await runSearchAndReply(waId, category.name, 0)
}

// Entry point for any inbound text from a sender who isn't a linked vendor — called from
// the restructured handleInboundMessage in lib/whatsapp/commands.ts. `contextMessageId`
// is set when this message is a reply/quote of a previous one (present on both this and
// the webhook's existing 'button'/'interactive' branches) — used here to resolve
// reply-to-select cart adds.
//
// Dispatch order, top to bottom:
// 1. "cancel" — works at any non-browsing stage, checked first.
// 2. Blocking checkout stages (awaiting_name/address/couriers/confirm/payment) own the
//    whole message — everything below is skipped entirely while mid-checkout.
// 3. Reply-to-a-product-result — a reply is a stronger, more specific signal than
//    parsing the reply's text, so it's checked before any keyword.
// 4. "more" / category keywords — existing, unambiguous commands.
// 5. "cart" / "remove N" / "checkout" (or buy-intent phrasing) — cart management.
// 6. Comma-separated fuzzy add ("sneakers, iphone case").
// 7. Greeting list.
// 8. Fallback: product search — this keeps "hair" or "how much for iPhone" reaching
//    search while "hey"/"howfar" still greet, exactly as before.
export async function handleBuyerMessage(waId: string, text: string, contextMessageId?: string): Promise<void> {
  const trimmed = String(text || '').trim()
  const lower = trimmed.toLowerCase()

  await connectToDatabase()
  const state: any = await WhatsAppBrowseState.findOne({ waId }).lean()
  const stage = String(state?.stage || 'browsing')

  if (lower === 'cancel') {
    const handled = await handleCancelCommand(waId, stage)
    if (handled) return
  }

  if (BLOCKING_CHECKOUT_STAGES.has(stage)) {
    await handleCheckoutStageMessage(waId, trimmed, stage)
    return
  }

  if (contextMessageId) {
    const handled = await tryHandleProductReply(waId, contextMessageId, trimmed)
    if (handled) return
  }

  if (lower === 'more') {
    await handleMoreCommand(waId)
    return
  }

  if (CATEGORY_KEYWORDS.has(lower)) {
    await sendCategoryMenu(waId)
    return
  }

  if (CART_VIEW_PATTERN.test(trimmed)) {
    await sendCartSummary(waId)
    return
  }

  const removeMatch = lower.match(REMOVE_PATTERN)
  if (removeMatch) {
    await handleRemoveCommand(waId, Number(removeMatch[1]))
    return
  }

  if (lower === 'checkout' || (trimmed.length <= BUY_INTENT_MAX_LENGTH && BUY_INTENT_PATTERN.test(trimmed))) {
    await handleCheckoutStart(waId)
    return
  }

  if (trimmed.includes(',')) {
    const handled = await tryHandleCommaSeparatedAdd(waId, trimmed)
    if (handled) return
  }

  if (!trimmed || GREETING_KEYWORDS.has(lower)) {
    await trySendText(waId, GREETING_MESSAGE)
    return
  }

  await runSearchAndReply(waId, trimmed, 0)
}
