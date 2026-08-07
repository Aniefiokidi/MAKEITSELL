// Buyer-facing WhatsApp flow — product search/browsing, cart, and checkout for an
// UNLINKED sender (i.e. not a linked vendor, see resolveLinkedVendor in
// lib/whatsapp/commands.ts). Every product read goes through the existing getProducts()
// (lib/mongodb-operations.ts) with status: 'active' explicitly passed, so this never
// surfaces inactive/out-of-stock inventory. Cart/checkout logic itself lives in
// lib/whatsapp/checkout.ts — this file is the router that decides whether a message is
// browsing/search or a checkout action.
import connectToDatabase from '@/lib/mongodb'
import { getProducts, getServices } from '@/lib/mongodb-operations'
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
} from '@/lib/whatsapp/service-quote'

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
    const handledService = await handleServiceReply(waId, contextMessageId, trimmed)
    if (handledService) return
  }

  // Mode/stage-agnostic — "accept REF"/"decline REF" for a delivered quote can arrive at
  // any time, regardless of what the buyer is currently doing (see
  // lib/whatsapp/service-quote.ts's comment on why this isn't a blocking stage).
  const handledQuoteDecision = await tryHandleQuoteDecision(waId, trimmed)
  if (handledQuoteDecision) return

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

  if (mode === 'services') {
    await runServiceSearchAndReply(waId, 0, { query: trimmed })
    return
  }
  await runSearchAndReply(waId, trimmed, 0)
}
