// Buyer-facing WhatsApp flow — product search/browsing, cart, and checkout for an
// UNLINKED sender (i.e. not a linked vendor, see resolveLinkedVendor in
// lib/whatsapp/commands.ts). Every product read goes through the existing getProducts()
// (lib/mongodb-operations.ts) with status: 'active' explicitly passed, so this never
// surfaces inactive/out-of-stock inventory. Cart/checkout logic itself lives in
// lib/whatsapp/checkout.ts — this file is the router that decides whether a message is
// browsing/search or a checkout action.
import connectToDatabase from '@/lib/mongodb'
import { getProducts, getServices, getBookingsByCustomer } from '@/lib/mongodb-operations'
import { Store } from '@/lib/models/Store'
import { WhatsAppBrowseState } from '@/lib/models/WhatsAppBrowseState'
import { WhatsAppBuyer } from '@/lib/models/WhatsAppBuyer'
import { Order } from '@/lib/models/Order'
import { sendTextMessage, sendInteractiveListMessage, type WhatsAppListRow } from '@/lib/whatsapp/client'
import { PRODUCT_CATEGORIES } from '@/lib/product-categories'
import { SERVICE_CATEGORIES } from '@/lib/service-categories'
import { sendProductResults } from '@/lib/whatsapp/product-results'
import { sendServiceResults } from '@/lib/whatsapp/service-results'
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
import {
  SERVICE_BOOKING_BLOCKING_STAGES,
  handleServiceReply,
  handleServiceBookingCancelCommand,
  handleServiceBookingStageMessage,
} from '@/lib/whatsapp/service-booking'
import {
  QUOTE_BLOCKING_STAGES,
  handleQuoteStageMessage,
  handleQuoteCancelCommand,
  tryHandleQuoteDecision,
  tryHandleQuoteCounter,
} from '@/lib/whatsapp/service-quote'
import {
  tryHandleServiceOfferReply,
  tryHandleNegotiationReply,
  tryHandleBookAgreedCommand,
} from '@/lib/whatsapp/service-negotiation'
import { tryHandleCustomerTopupCommand } from '@/lib/whatsapp/wallet-topup'
import { tryHandleCustomerWithdrawalFlow } from '@/lib/whatsapp/customer-withdrawal'
import { tryHandleClaimAccountCommand } from '@/lib/whatsapp/claim-account'

const RESULTS_PER_PAGE = 4
// Fetch one extra beyond the display page so "are there more results" can be answered
// from this one query instead of a separate count query.
const FETCH_PER_PAGE = RESULTS_PER_PAGE + 1
// Meta's interactive list hard cap is 10 rows total across all sections combined.
const MAX_LIST_ROWS = 10

// Deliberately an explicit, exact-match list — NOT a fuzzy/substring check. A buyer
// typing a product name (e.g. "hair", "how much for iPhone") must always reach search,
// never get misfired into a greeting reply. When in doubt, it's a search.
// Broadened after real usage turned up common variants the original short list missed
// (typo'd/doubled letters, bare "morning"/"afternoon"/"evening", "hola", Pidgin group
// phrasing) — same "expand keyword coverage" direction as the earlier cart-phrasing fix,
// deliberately kept as an explicit list rather than adding an NLU layer.
const GREETING_KEYWORDS = new Set([
  'hi', 'hello', 'hey', 'hiya', 'howdy', 'yo', 'start', 'help',
  'hii', 'hiii', 'heyy', 'heyyy', 'hola',
  'good morning', 'good afternoon', 'good evening', 'gm',
  'morning', 'afternoon', 'evening',
  'howfar', 'how far', 'how far now', 'how una dey', 'how you dey',
  'wetin dey', 'wetin dey happen', 'wetin dey sup', 'wetin sup',
  'abeg', 'wassup', 'whats up', "what's up", 'sup',
])
// A buyer wrapping up a conversation ("thanks", "thank you", Pidgin "God bless") with no
// further question — previously fell through to a failed product search for the literal
// word "thanks", a visibly wrong reply for what's really just a sign-off.
const THANKS_PATTERN = /^(thanks?( you| u)?|thank\s*you|tanx|tnx|God bless( you)?|much appreciated)[\s!.]*$/i
const THANKS_REPLY = "You're welcome! Search anytime you need something else."
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
// A buyer asking about an EXISTING order — must be checked before BUY_INTENT_PATTERN, or
// the bare word "order" in "where is my order" would misroute into STARTING a new
// checkout instead of answering the question (a real, confirmed gap: nothing handled
// this before). Requires "order"/"delivery"/"package" together with a query word, so a
// genuine product search mentioning "order" in passing (rare, but possible) isn't caught.
const ORDER_STATUS_PATTERN = /\b(order|delivery|package|parcel)\b[\s\S]*\b(status|where|track|shipped?|arriv(ed|ing)?|coming|dey)\b|\b(where|status|track)\b[\s\S]*\b(order|delivery|package|parcel)\b|wetin.*order/i

// "my bookings" / "booking status" — the services counterpart to ORDER_STATUS_PATTERN.
// Deliberately requires "my" or a status word alongside booking/appointment: the bare word
// "bookings" alone is already claimed by SERVICE_ENTRY_KEYWORDS below (switches into
// services-browsing mode), so this must never bare-match it.
const BOOKING_STATUS_PATTERN = /\bmy\s+(bookings?|appointments?)\b|\b(bookings?|appointments?)\b[\s\S]*\b(status|where|track)\b/i

// Entry into services browsing (Phase S1) — deliberately multi-word/unambiguous phrases,
// NOT the bare word "book" alone. Once already in services mode, a bare "book" means
// "book what I'm looking at" (SERVICE_BOOK_INTENT_PATTERN below), not "show me services
// again" — keeping entry phrases distinct from booking-intent phrasing avoids the two
// colliding on the single word both would otherwise share.
const SERVICE_ENTRY_KEYWORDS = new Set([
  'services', 'service', 'book a service', 'book service', 'browse services', 'bookings',
])
// Switches back out of services mode — symmetric with SERVICE_ENTRY_KEYWORDS. Buyers who
// never say either stay in 'goods' mode forever, so this is unreachable dead code for the
// vast majority of the existing user base, by design.
const GOODS_EXIT_KEYWORDS = new Set(['shop', 'products', 'goods', 'buy products'])
// Fires on generic booking-intent phrasing with no specific service context (only
// checked once already in services mode — see handleBuyerMessage — so it can't fire for a
// goods buyer who happens to type "schedule" or "appointment" while shopping for
// products). Booking a SPECIFIC service (Phase S2, requiresQuote: false only) actually
// happens by replying to that service's result message — see handleServiceReply in
// lib/whatsapp/service-booking.ts — not from this generic keyword, which has no service
// to book yet.
const SERVICE_BOOK_INTENT_PATTERN = /\b(book|reserve|schedule|appointment)\b/i
const SERVICE_BOOKING_SOON_MESSAGE =
  'To book, reply directly to the service you\'re interested in from the results above — that starts booking it. Search first if you haven\'t seen it yet, or reply "categories" to browse.'
const SERVICE_GREETING_MESSAGE =
  'Looking for a service? Reply "categories" to browse, or type what you need (e.g. "hair braiding", "photographer").\n\nType "shop" anytime to go back to browsing products.'

// A message using first-person/conversational phrasing ("I want...", "can I...", "do you
// have...") is virtually never a literal product name — real product searches are short
// noun phrases ("sneakers", "red long sleeve shirt"). Treating a full conversational
// sentence as a literal $text query against products is what let a real buyer's "I want
// to book a service from DTO ventures" come back with an unrelated product from a
// totally different vendor (it matched on a stray word buried in that product's
// description — see buyer.ts's runSearchAndReply/getProducts' unscoped $text search).
// Caught here, before the blind search, so a conversational sentence gets routed toward
// intent (a named store, or services) or a clarifying nudge instead of a confidently
// wrong result.
const CONVERSATIONAL_PHRASING_PATTERN =
  /\b(i want|i'd like|i would like|i need|i wan|abeg|can i|could i|do you have|is there|i am looking|i'm looking|looking for|please (help|show|find))\b/i
const CONVERSATIONAL_CLARIFY_MESSAGE =
  'Got it! For the fastest match, reply with just the product name (e.g. "sneakers"), or type "categories" to browse, or "services" to book a service.'

// Extracts a candidate store/vendor name from "... from X" / "... at X" / "... by X"
// phrasing, falling back to the whole trimmed message (covers a buyer just typing a bare
// store name, e.g. "DTO ventures", which the product search structurally can't match —
// Product documents only carry the vendor's personal account name, not their store's
// business name; see getProducts' comment on vendorName vs storeName).
const STORE_MENTION_PATTERN = /\b(?:from|at|by)\s+([a-z0-9][a-z0-9 &'-]{1,40})\s*$/i
// "for" is too generic a preposition to trust in general ("looking for shoes" isn't
// naming a vendor) — only tried when the message already carries booking intent, where
// "book/service ... for X" unambiguously means "regarding vendor X" (real Pidgin example:
// "abeg I wan book service for DTO ventures").
const STORE_MENTION_FOR_PATTERN = /\bfor\s+([a-z0-9][a-z0-9 &'-]{1,40})\s*$/i

// Resolves a named store via the Store collection's own weighted text index
// (storeName: 10) and answers with THAT store's real products or services — instead of
// falling through to a product-only search that can never match a store's business name.
// Returns false (does nothing) if no store name-level match is found, so the caller can
// fall back to its normal search.
async function tryHandleStoreMention(waId: string, trimmed: string, wantsBooking: boolean): Promise<boolean> {
  const fromMatch = trimmed.match(STORE_MENTION_PATTERN) || (wantsBooking ? trimmed.match(STORE_MENTION_FOR_PATTERN) : null)
  const candidate = (fromMatch ? fromMatch[1] : trimmed).trim()
  if (candidate.length < 3) return false
  // Without an explicit "from/at/by" signal, only try resolving the WHOLE message as a
  // store name when it's multi-word — a bare single word ("beauty", "shoes") is far more
  // likely a category/product term than a store name, and this catalog's rare single-word
  // store names aren't worth the risk of hijacking a real category search whose term
  // happens to substring-match some unrelated store's name.
  if (!fromMatch && candidate.split(/\s+/).length < 2) return false

  await connectToDatabase()
  const store: any = await Store.findOne(
    { $text: { $search: candidate }, isActive: { $ne: false } },
    { score: { $meta: 'textScore' } }
  ).sort({ score: { $meta: 'textScore' } }).lean()
  if (!store) return false

  // Require the match to actually be the store's NAME, not just a stray word elsewhere
  // in its description/address/category — same relevance discipline the product search
  // should have had. A loose $text hit alone isn't enough to confidently address the
  // buyer by a specific store's name.
  const nameLower = String(store.storeName || '').toLowerCase()
  const candidateLower = candidate.toLowerCase()
  if (!nameLower || (!nameLower.includes(candidateLower) && !candidateLower.includes(nameLower))) return false

  const vendorId = String(store.vendorId || '')
  if (!vendorId) return false

  if (wantsBooking) {
    const services = await getServices({ providerId: vendorId, status: 'active', limitCount: RESULTS_PER_PAGE })
    if (services.length === 0) {
      await trySendText(
        waId,
        `${store.storeName} doesn't have any bookable services right now. Reply "categories" to browse other services, or type "shop" to see what ${store.storeName} sells instead.`
      )
      return true
    }
    await Promise.all([
      sendServiceResults(waId, services),
      WhatsAppBrowseState.findOneAndUpdate(
        { waId },
        { $set: { browseMode: 'services', lastQuery: candidate, offset: services.length, updatedAt: new Date() } },
        { upsert: true }
      ),
    ])
    return true
  }

  const products = await getProducts({ vendorId, status: 'active', limitCount: RESULTS_PER_PAGE })
  if (products.length === 0) {
    await trySendText(waId, `${store.storeName} doesn't have any products listed right now.`)
    return true
  }
  await Promise.all([
    sendProductResults(waId, products),
    WhatsAppBrowseState.findOneAndUpdate(
      { waId },
      { $set: { lastQuery: candidate, offset: products.length, updatedAt: new Date() } },
      { upsert: true }
    ),
  ])
  return true
}

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

// Services counterpart to runSearchAndReply — same paging/reply-batching shape, but
// against getServices()/sendServiceResults() instead of getProducts()/sendProductResults().
// Always writes browseMode: 'services' alongside the paging state, so a buyer who entered
// services mode via a category tap (not a typed keyword) stays in it for subsequent "more".
//
// Takes EITHER a free-text query OR a category slug, not both — see
// WhatsAppBrowseState.lastCategorySlug for why services category browsing is an exact
// filter rather than a free-text search the way goods' category browsing is.
async function runServiceSearchAndReply(
  waId: string,
  offset: number,
  target: { query: string; categorySlug?: undefined } | { query?: undefined; categorySlug: string; categoryLabel: string }
): Promise<void> {
  await connectToDatabase()

  const services = await getServices({
    ...(target.categorySlug ? { category: target.categorySlug } : { search: target.query }),
    status: 'active',
    limitCount: FETCH_PER_PAGE,
    skipCount: offset,
  })

  const label = target.categorySlug ? target.categoryLabel : target.query

  if (services.length === 0) {
    console.log(`[whatsapp-buyer] service search: no results for "${label}" (offset ${offset}) — ${waId}`)
    await trySendText(
      waId,
      offset > 0
        ? `No more results for "${label}".`
        : `No services found for "${label}". Try a different search, or type "categories" to browse.`
    )
    return
  }

  const hasMore = services.length > RESULTS_PER_PAGE
  const pageItems = services.slice(0, RESULTS_PER_PAGE)

  console.log(`[whatsapp-buyer] service search: sending ${pageItems.length} result(s) for "${label}" (offset ${offset}, hasMore ${hasMore}) — ${waId}`)

  await Promise.all([
    sendServiceResults(waId, pageItems),
    WhatsAppBrowseState.findOneAndUpdate(
      { waId },
      target.categorySlug
        ? {
            $set: { browseMode: 'services', lastCategorySlug: target.categorySlug, offset: offset + pageItems.length, updatedAt: new Date() },
            $unset: { lastQuery: '' },
          }
        : {
            $set: { browseMode: 'services', lastQuery: target.query, offset: offset + pageItems.length, updatedAt: new Date() },
            $unset: { lastCategorySlug: '' },
          },
      { upsert: true }
    ),
  ])

  if (hasMore) {
    await trySendText(waId, `Reply "more" to see more results for "${label}".`)
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

  if (state?.browseMode === 'services') {
    if (state?.lastCategorySlug) {
      const category = SERVICE_CATEGORIES.find((c) => c.slug === state.lastCategorySlug)
      if (category) {
        await runServiceSearchAndReply(waId, Number(state.offset || 0), { categorySlug: category.slug, categoryLabel: category.name })
        return
      }
    }
    if (state?.lastQuery) {
      await runServiceSearchAndReply(waId, Number(state.offset || 0), { query: state.lastQuery })
      return
    }
    console.log(`[whatsapp-buyer] more: no prior services search for ${waId}`)
    await trySendText(waId, 'Nothing to continue — search for a service by typing what you need, or type "categories" to browse.')
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

// Services counterpart to sendCategoryMenu. Row ids are prefixed "service-category:"
// (vs goods' "category:") so the webhook's list-reply dispatch (see
// app/api/whatsapp/webhook/route.ts) can tell which menu a tap came from — SERVICE_CATEGORIES
// has no per-category description (unlike PRODUCT_CATEGORIES), so rows are title-only.
// Also sets browseMode: 'services', same as a typed entry keyword would.
async function sendServiceCategoryMenu(waId: string): Promise<void> {
  await WhatsAppBrowseState.findOneAndUpdate(
    { waId },
    { $set: { browseMode: 'services', updatedAt: new Date() } },
    { upsert: true }
  )
  const rows: WhatsAppListRow[] = SERVICE_CATEGORIES.slice(0, MAX_LIST_ROWS).map((category) => ({
    id: `service-category:${category.slug}`,
    title: category.name.slice(0, 24),
  }))
  await trySendList(waId, 'Browse services by category:', 'Categories', rows)
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

// Services counterpart to handleCategorySelection — handles a tap on the list sent by
// sendServiceCategoryMenu ("service-category:<slug>" row ids).
export async function handleServiceCategorySelection(waId: string, rowId: string): Promise<void> {
  const slug = String(rowId || '').replace(/^service-category:/, '')
  const category = SERVICE_CATEGORIES.find((c) => c.slug === slug)
  if (!category) {
    console.log(`[whatsapp-buyer] service category selection: unknown row id "${rowId}" from ${waId}`)
    await trySendText(waId, "Couldn't find that category. Type \"categories\" to see the list again.")
    return
  }
  console.log(`[whatsapp-buyer] service category selection: ${waId} -> ${category.slug}`)
  await runServiceSearchAndReply(waId, 0, { categorySlug: category.slug, categoryLabel: category.name })
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  pending_payment: 'Awaiting payment',
  confirmed: 'Confirmed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  received: 'Received',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

function shortOrderRef(orderId: string): string {
  return String(orderId || '').slice(0, 8).toUpperCase()
}

function formatOrderItemsSummary(items: any[]): string {
  const list = Array.isArray(items) ? items : []
  const parts = list.slice(0, 2).map((item: any) => `${Math.max(1, Number(item?.quantity || 1))}x ${String(item?.title || item?.name || 'Item')}`)
  const extra = list.length > 2 ? ` +${list.length - 2} more` : ''
  return (parts.join(', ') || 'items') + extra
}

// Answers "where is my order" / "track my order" and similar — previously unhandled, so
// this fell through to BUY_INTENT_PATTERN's bare "order" match and misrouted into
// starting a NEW checkout. Reports the buyer's most recent orders (up to 3), with a
// per-vendor breakdown when a multi-vendor order's legs have diverged (one shipped,
// another still pending) rather than a single misleading top-level status.
async function sendOrderStatus(waId: string): Promise<void> {
  await connectToDatabase()
  const mapping: any = await WhatsAppBuyer.findOne({ waId }).lean()
  if (!mapping?.customerId) {
    await trySendText(waId, "You haven't placed an order with us yet — search for a product to get started.")
    return
  }

  const orders: any[] = await Order.find({ customerId: mapping.customerId })
    .sort({ createdAt: -1 })
    .limit(3)
    .select('orderId status vendors items')
    .lean()

  if (orders.length === 0) {
    await trySendText(waId, "You haven't placed an order with us yet — search for a product to get started.")
    return
  }

  const lines = orders.map((order) => {
    const ref = shortOrderRef(order.orderId)
    const vendors: any[] = Array.isArray(order.vendors) ? order.vendors : []
    const vendorStatuses = vendors.map((v) => String(v?.status || '').trim()).filter(Boolean)
    const uniqueStatuses = Array.from(new Set(vendorStatuses))

    if (uniqueStatuses.length > 1) {
      const vendorLines = vendors.map((v) => {
        const label = ORDER_STATUS_LABELS[v?.status] || v?.status || 'Pending'
        return `  - ${formatOrderItemsSummary(v?.items)}: ${label}`
      })
      return `Order ${ref}:\n${vendorLines.join('\n')}`
    }

    const status = uniqueStatuses[0] || order.status || 'pending'
    const label = ORDER_STATUS_LABELS[status] || status
    const allItems = order.items?.length ? order.items : vendors.flatMap((v) => v?.items || [])
    return `Order ${ref}: ${formatOrderItemsSummary(allItems)} — ${label}`
  })

  console.log(`[whatsapp-buyer] order status: sent ${orders.length} order(s) to ${waId}`)
  await trySendText(waId, `Your recent orders:\n\n${lines.join('\n\n')}`)
}

// Answers "my bookings" / "my appointments" and similar — the services-booking
// counterpart to sendOrderStatus above, same shape (up to 3 most recent, one line each).
// Reuses getBookingsByCustomer (lib/mongodb-operations.ts) rather than re-querying Booking
// directly, so this can never drift from what app/appointments/page.tsx shows on web.
async function sendMyBookings(waId: string): Promise<void> {
  await connectToDatabase()
  const mapping: any = await WhatsAppBuyer.findOne({ waId }).lean()
  if (!mapping?.customerId) {
    await trySendText(waId, "You haven't booked a service with us yet — reply \"services\" to browse.")
    return
  }

  const bookings = await getBookingsByCustomer(mapping.customerId)
  const recent = bookings.slice(0, 3)

  if (recent.length === 0) {
    await trySendText(waId, "You haven't booked a service with us yet — reply \"services\" to browse.")
    return
  }

  const lines = recent.map((booking: any) => {
    const ref = shortOrderRef(String(booking.id))
    const dateLabel = booking.bookingDate
      ? new Date(booking.bookingDate).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })
      : ''
    const label = ORDER_STATUS_LABELS[booking.status] || booking.status || 'Pending'
    return `${ref}: ${booking.serviceTitle || 'Service'} — ${dateLabel}${booking.startTime ? `, ${booking.startTime}` : ''} — ${label}`
  })

  console.log(`[whatsapp-buyer] my bookings: sent ${recent.length} booking(s) to ${waId}`)
  await trySendText(waId, `Your recent bookings:\n\n${lines.join('\n\n')}`)
}

// Entry point for any inbound text from a sender who isn't a linked vendor — called from
// the restructured handleInboundMessage in lib/whatsapp/commands.ts. `contextMessageId`
// is set when this message is a reply/quote of a previous one (present on both this and
// the webhook's existing 'button'/'interactive' branches) — used here to resolve
// reply-to-select cart adds.
//
// Dispatch order, top to bottom:
// 1. "cancel" — works at any non-browsing stage, checked first. Tries the services-
//    booking cancel (Phase S2) before goods' — the two stage sets are disjoint (see
//    lib/models/WhatsAppBrowseState.ts's stage enum), so exactly one of them, or neither,
//    ever actually handles a given cancel.
// 2. Services-booking blocking stages (choosing_service_package through
//    awaiting_booking_payment, lib/whatsapp/service-booking.ts) own the whole message —
//    checked before goods' blocking stages since the two sets are disjoint and a buyer is
//    only ever in one stage at a time regardless of which set it's from.
// 3. Blocking checkout stages (awaiting_name/address/couriers/confirm/payment) own the
//    whole message — everything below is skipped entirely while mid-checkout. Goods-only
//    concept, unaffected by browseMode.
// 4. Reply-to-a-product-or-service-result — a reply is a stronger, more specific signal
//    than parsing the reply's text, so it's checked before any keyword. Tries goods first,
//    then services (lib/whatsapp/service-booking.ts's handleServiceReply) — a given
//    message id only ever resolves in one of the two message-map collections, so trying
//    both in sequence is safe, not ambiguous. A reply to a requiresQuote: true service
//    sends the S3-placeholder message here rather than starting a booking.
// 5. "more" — mode-aware (handleMoreCommand branches on browseMode internally).
// 6. Category keywords — mode-aware: shows the services category menu instead of goods'
//    while browseMode is 'services'.
// 7. Services entry phrases ("services", "book a service", ...) — switch browseMode and
//    show the services category menu. Goods exit phrases ("shop", "products") switch back.
//    Both checked here, before any goods-specific keyword below, so they work regardless
//    of current mode.
// 8. Order-status query ("where is my order") — checked before buy-intent below, since
//    "order" alone would otherwise misroute this into starting a NEW checkout. Mode-
//    agnostic: order history is goods-only today, but answering it doesn't depend on
//    what the buyer is currently browsing.
// 9. "cart" / "remove N" / "checkout" (or buy-intent phrasing) — cart management,
//    goods-only, mode-agnostic for the same reason as order-status above.
// 10. Service booking-intent ("book", "reserve", "schedule", "appointment") with no
//     specific service context — only checked while browseMode is 'services'. Points the
//     buyer at replying to a specific service result (item 4 above), since that's the
//     actual way to book one; this is just the generic-keyword fallback when there's no
//     service to book yet. Placed after goods' buy-intent/checkout so a services-mode
//     buyer typing "buy" still reaches that existing goods path unmodified.
// 11. Comma-separated fuzzy add ("sneakers, iphone case") — goods cart-add, gated to
//     browseMode 'goods' so a services-mode buyer typing "braiding, makeup" doesn't
//     silently attempt (and fail) a goods cart lookup before falling through to search.
// 12. Greeting list / thanks sign-off — mode-aware greeting text.
// 13. Fallback: mode-aware search — this keeps "hair" or "how much for iPhone" reaching
//    goods search while "hey"/"howfar" still greet, exactly as before; in services mode,
//    the same fallback position reaches service search instead.
export async function handleBuyerMessage(waId: string, text: string, contextMessageId?: string): Promise<void> {
  const trimmed = String(text || '').trim()
  const lower = trimmed.toLowerCase()

  // Withdrawal — a completely separate state track from the goods/services stage machine
  // below (lives on WhatsAppBuyer, not WhatsAppBrowseState), checked first and unconditionally
  // so an active withdrawal conversation always owns the whole message, same "blocking
  // stage" precedent as QUOTE_BLOCKING_STAGES further down.
  if (await tryHandleCustomerWithdrawalFlow(waId, trimmed)) return

  await connectToDatabase()
  const state: any = await WhatsAppBrowseState.findOne({ waId }).lean()
  const stage = String(state?.stage || 'browsing')
  const mode = String(state?.browseMode || 'goods')

  if (lower === 'cancel') {
    const handledQuote = await handleQuoteCancelCommand(waId, stage)
    if (handledQuote) return
    const handledBooking = await handleServiceBookingCancelCommand(waId, stage)
    if (handledBooking) return
    const handled = await handleCancelCommand(waId, stage)
    if (handled) return
  }

  if (QUOTE_BLOCKING_STAGES.has(stage)) {
    await handleQuoteStageMessage(waId, trimmed, stage)
    return
  }

  if (SERVICE_BOOKING_BLOCKING_STAGES.has(stage)) {
    await handleServiceBookingStageMessage(waId, trimmed, stage)
    return
  }

  if (BLOCKING_CHECKOUT_STAGES.has(stage)) {
    await handleCheckoutStageMessage(waId, trimmed, stage)
    return
  }

  if (contextMessageId) {
    const handledProduct = await tryHandleProductReply(waId, contextMessageId, trimmed)
    if (handledProduct) return
    // Phase S4 Part B — "offer AMOUNT" as a reply to a service card, before the normal
    // booking-reply handler so it doesn't get misread as a booking-start reply.
    const handledOffer = await tryHandleServiceOfferReply(waId, contextMessageId, trimmed)
    if (handledOffer) return
    const handledService = await handleServiceReply(waId, contextMessageId, trimmed)
    if (handledService) return
  }

  // Mode/stage-agnostic — "accept REF"/"decline REF" for a delivered quote can arrive at
  // any time, regardless of what the buyer is currently doing (see
  // lib/whatsapp/service-quote.ts's comment on why this isn't a blocking stage).
  const handledQuoteDecision = await tryHandleQuoteDecision(waId, trimmed)
  if (handledQuoteDecision) return

  // Phase S4 Part A — "counter REF AMOUNT", same mode/stage-agnostic reasoning as above.
  const handledQuoteCounter = await tryHandleQuoteCounter(waId, trimmed)
  if (handledQuoteCounter) return

  // Phase S4 Part B — same ref vocabulary against PriceNegotiation instead of Booking;
  // only reached once both Part A checks above have found the ref doesn't belong to one of
  // the buyer's quoted bookings (they return false rather than erroring in that case).
  const handledNegotiationReply = await tryHandleNegotiationReply(waId, trimmed)
  if (handledNegotiationReply) return

  const handledBookAgreed = await tryHandleBookAgreedCommand(waId, trimmed)
  if (handledBookAgreed) return

  if (lower === 'more') {
    await handleMoreCommand(waId)
    return
  }

  if (CATEGORY_KEYWORDS.has(lower)) {
    if (mode === 'services') {
      await sendServiceCategoryMenu(waId)
    } else {
      await sendCategoryMenu(waId)
    }
    return
  }

  if (SERVICE_ENTRY_KEYWORDS.has(lower)) {
    await sendServiceCategoryMenu(waId)
    return
  }

  if (GOODS_EXIT_KEYWORDS.has(lower)) {
    await WhatsAppBrowseState.findOneAndUpdate(
      { waId },
      { $set: { browseMode: 'goods', updatedAt: new Date() } },
      { upsert: true }
    )
    await trySendText(waId, GREETING_MESSAGE)
    return
  }

  if (ORDER_STATUS_PATTERN.test(trimmed)) {
    await sendOrderStatus(waId)
    return
  }

  if (BOOKING_STATUS_PATTERN.test(trimmed)) {
    await sendMyBookings(waId)
    return
  }

  if (await tryHandleCustomerTopupCommand(waId, trimmed)) return

  if (await tryHandleClaimAccountCommand(waId, trimmed)) return

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

  if (mode === 'services' && SERVICE_BOOK_INTENT_PATTERN.test(trimmed)) {
    await trySendText(waId, SERVICE_BOOKING_SOON_MESSAGE)
    return
  }

  if (mode === 'goods' && trimmed.includes(',')) {
    const handled = await tryHandleCommaSeparatedAdd(waId, trimmed)
    if (handled) return
  }

  if (!trimmed || GREETING_KEYWORDS.has(lower)) {
    await trySendText(waId, mode === 'services' ? SERVICE_GREETING_MESSAGE : GREETING_MESSAGE)
    return
  }

  if (THANKS_PATTERN.test(trimmed)) {
    await trySendText(waId, THANKS_REPLY)
    return
  }

  // Booking/service intent expressed as a full sentence (not one of the exact
  // SERVICE_ENTRY_KEYWORDS phrases caught earlier) — e.g. "I want to book a service from
  // DTO ventures" — and bare/explicit store-name mentions in general. Checked here,
  // right before the blind search fallback, so neither ever reaches a product-only
  // $text search that structurally can't answer them correctly (see tryHandleStoreMention
  // and CONVERSATIONAL_PHRASING_PATTERN's comments for the real incident this fixes).
  const wantsBooking = SERVICE_BOOK_INTENT_PATTERN.test(trimmed) || /\bservices?\b/i.test(trimmed)

  if (await tryHandleStoreMention(waId, trimmed, wantsBooking)) return

  if (CONVERSATIONAL_PHRASING_PATTERN.test(trimmed)) {
    if (wantsBooking) {
      await WhatsAppBrowseState.findOneAndUpdate(
        { waId },
        { $set: { browseMode: 'services', updatedAt: new Date() } },
        { upsert: true }
      )
      await trySendText(waId, SERVICE_GREETING_MESSAGE)
      return
    }
    await trySendText(waId, CONVERSATIONAL_CLARIFY_MESSAGE)
    return
  }

  if (mode === 'services') {
    await runServiceSearchAndReply(waId, 0, { query: trimmed })
    return
  }
  await runSearchAndReply(waId, trimmed, 0)
}
