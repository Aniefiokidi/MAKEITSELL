// Buyer-facing WhatsApp flow — product search/browsing, cart, and checkout for an
// UNLINKED sender (i.e. not a linked vendor, see resolveLinkedVendor in
// lib/whatsapp/commands.ts). Product searches use catalog-search.ts and store browsing
// uses getProducts() with status: 'active'. Cart/checkout logic itself lives in
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
import { searchCatalogProducts } from '@/lib/whatsapp/catalog-search'
import { parseCatalogQuery } from '@/lib/whatsapp/catalog-query'
import { requestedItem, splitShoppingList } from '@/lib/whatsapp/buyer-intent'
import { answerBuyerFaq } from '@/lib/whatsapp/buyer-faq'
import {
  PROVIDERS_PER_PAGE,
  UNKNOWN_LOCATION,
  findNearbyProviders,
  searchServiceCandidates,
  serviceLabel,
  locationPrompt,
  parseBuyerLocation,
  sendProviderCards,
  splitServiceQueryAndLocation,
  tryHandleProviderCardReply,
  type BuyerLocation,
} from '@/lib/whatsapp/service-contacts'
import { parseResultReference, listRecentResults, type RecentResult } from '@/lib/whatsapp/recent-results'
import { answerProductQuestion } from '@/lib/whatsapp/product-answers'
import { Product } from '@/lib/models/Product'
import {
  BLOCKING_CHECKOUT_STAGES,
  handleProductAction,
  tryHandleProductReply,
  sendCartSummary,
  handleRemoveCommand,
  handleCheckoutStart,
  handleCancelCommand,
  handleCheckoutStageMessage,
} from '@/lib/whatsapp/checkout'
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
// Only standalone checkout requests start checkout. "I want to buy shoes" contains a
// product search and must not open an empty cart.
const CHECKOUT_INTENT_PATTERN = /^(?:buy|purchase|checkout|order|place (?:my|an?) order|i(?:'m| am) ready to (?:buy|checkout|order))\s*[!.]?$/i
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
// Generic booking-intent phrasing ("I want to book a photographer") is treated as a
// service request. Services are contact-only on WhatsApp (see
// lib/whatsapp/service-contacts.ts): the bot sends the closest providers' contact details
// and an estimated rate, and the buyer arranges everything with the provider directly.
const SERVICE_BOOK_INTENT_PATTERN = /\b(book|reserve|schedule|appointment|hire)\b/i
const SERVICE_BOOKING_SOON_MESSAGE =
  'Bookings happen directly with the provider — message them on the number shown on their card. If you haven\'t seen one yet, tell me what service you need and where you are, or type "categories" to browse.'
const SERVICE_GREETING_MESSAGE =
  'Looking for a service? Tell me what you need and where you are (e.g. "hair braiding in Ikeja", "photographer, Abuja"), or reply "categories" to browse. I\'ll send you the closest providers\' contact details and their rates.\n\nType "shop" anytime to go back to browsing products.'
// Bare "awaiting_service_location" stage: the buyer asked for a service before telling us
// where they are, so the next message is read as a location (or a location pin) first.
const AWAITING_SERVICE_LOCATION_STAGE = 'awaiting_service_location'

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
  /\b(i want|i'd like|i would like|i need|i wan|abeg|can i|could i|do you have|is there|i am looking|i'm looking|looking for|please (help|show|find)|how much (?:is|are|for)|price (?:of|for))\b/i
const CONVERSATIONAL_CLARIFY_MESSAGE =
  'Tell me the product or service you need (e.g. "sneakers" or "hair braiding"). You can also type "categories" to browse.'

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
        `${store.storeName} doesn't have any services listed right now. Reply "categories" to browse other services, or type "shop" to see what ${store.storeName} sells instead.`
      )
      return true
    }
    // A named store is a direct request — send that store's contact cards without
    // needing the buyer's location (distance is only shown when we already know it).
    const state: any = await WhatsAppBrowseState.findOne({ waId }).select('buyerLocation').lean()
    const matches = (await findNearbyProviders({ query: String((services[0] as any)?.title || services[0]?.name || '') }, state?.buyerLocation || null))
      .filter((m) => String(m.service?.providerId || '') === vendorId)
    if (matches.length === 0) {
      await trySendText(waId, `${store.storeName} hasn't added a contact number for their services yet. Reply "categories" to browse other providers.`)
      return true
    }
    await Promise.all([
      sendProviderCards(waId, matches.slice(0, PROVIDERS_PER_PAGE)),
      WhatsAppBrowseState.findOneAndUpdate(
        { waId },
        { $set: { browseMode: 'services', updatedAt: new Date() }, $unset: { lastQuery: '', lastCategorySlug: '', matchMode: '' } },
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
      { $set: { browseMode: 'goods', updatedAt: new Date() }, $unset: { lastQuery: '', lastCategorySlug: '', matchMode: '' } },
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
  'Hi! Tell me what you need, for example "sneakers under ₦20,000". You can ask about price, stock, color, or size by replying to a product card.\n\nReply "add" to a card to choose it, "categories" to browse, "services" to find a provider near you, or "more" for more matches.'

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
    await trySendText(waId, `${bodyText}\n\n${rows.map((row) => `- ${row.title}`).join('\n')}\n\nType a category name to search.`)
  }
}

// Runs a product search (free text or a category name) and sends up to RESULTS_PER_PAGE
// results as image+caption messages, persisting paging state so a later "more" picks up
// where this left off. `offset` is the number of results already shown for this query.
async function runSearchAndReply(waId: string, query: string, offset: number): Promise<void> {
  await connectToDatabase()

  if (query.trim().length > 80) {
    await trySendText(waId, 'Please use a shorter product name, such as "red sneakers", so I can find a useful match.')
    return
  }
  if (!parseCatalogQuery(query).term) {
    await trySendText(waId, 'What item are you looking for? For example, "sneakers under ₦20,000".')
    return
  }

  const products = await searchCatalogProducts(query, offset, FETCH_PER_PAGE)

  if (products.length === 0) {
    console.log(`[whatsapp-buyer] search: no results for "${query}" (offset ${offset}) — ${waId}`)
    // "hair braider" or "plumber" isn't a product — before giving up, see whether it's a
    // service and hand over to the provider-contact flow if so.
    if (offset === 0) {
      const { query: serviceQuery, location } = splitServiceQueryAndLocation(query)
      const serviceHits = await searchServiceCandidates(serviceQuery, 1)
      if (serviceHits.length > 0) {
        await runServiceSearchAndReply(waId, 0, { query: serviceQuery }, location)
        return
      }
    }
    if (offset === 0) {
      await WhatsAppBrowseState.findOneAndUpdate(
        { waId },
        { $set: { browseMode: 'goods', updatedAt: new Date() }, $unset: { lastQuery: '', lastCategorySlug: '', matchMode: '' } },
        { upsert: true }
      )
    }
    const wordCount = parseCatalogQuery(query).term.split(/\s+/).filter(Boolean).length
    await trySendText(
      waId,
      offset > 0
        ? `No more results for "${query}".`
        : wordCount >= 4
          ? `I couldn't match "${query}" to anything yet. Tell me the specific item or service you have in mind (e.g. "wristwatch", "perfume", "plumber in Yaba"), or type "categories" to browse.`
          : `I couldn't find a close match for "${query}" among products or services. Try fewer words${parseCatalogQuery(query).maxPrice ? ' or a higher budget' : ''}, another name for it, or type "categories" to browse.`
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
        $set: { browseMode: 'goods', lastQuery: query, offset: offset + pageItems.length, updatedAt: new Date() },
        $unset: { lastCategorySlug: '', matchMode: '', lastImageHash: '', lastImageEmbedding: '', lastVisualCategory: '' },
      },
      { upsert: true }
    ),
  ])

  if (hasMore) {
    await trySendText(waId, `Reply "more" to see more results for "${query}".`)
  }
}

// A comma-separated message is a shopping list, not permission to add a fuzzy match
// to the cart. Show candidates for each item and let the buyer select a card.
async function searchShoppingList(waId: string, text: string): Promise<boolean> {
  const items = splitShoppingList(text)
  if (items.length < 2) return false
  if (items.length > 3) {
    await trySendText(waId, 'Please send up to 3 items at a time so I can show useful matches for each.')
    return true
  }

  const queries = items.map((item) => requestedItem(item) || item)
  const results = await Promise.all(queries.map((query) => searchCatalogProducts(query, 0, 3)))
  for (let index = 0; index < items.length; index++) {
    const matches = results[index]
    if (matches.length === 0) {
      await trySendText(waId, `No close match for "${items[index]}". Try a shorter name.`)
      continue
    }
    await trySendText(waId, `Matches for "${items[index]}":`)
    await sendProductResults(waId, matches.slice(0, 2))
  }
  const lastItem = queries[queries.length - 1]
  const lastMatches = results[results.length - 1]
  await WhatsAppBrowseState.findOneAndUpdate(
    { waId },
    lastMatches.length > 0
      ? { $set: { browseMode: 'goods', lastQuery: lastItem, offset: Math.min(lastMatches.length, 2), updatedAt: new Date() }, $unset: { lastCategorySlug: '', matchMode: '' } }
      : { $set: { browseMode: 'goods', updatedAt: new Date() }, $unset: { lastQuery: '', lastCategorySlug: '', matchMode: '' } },
    { upsert: true }
  )
  await trySendText(waId, `Reply "add" to a specific product card to add it.${lastMatches.length > 2 ? ' Reply "more" for more matches for the last item.' : ''}`)
  return true
}

// Services counterpart to runSearchAndReply. Contact-only: resolves where the buyer is
// (from the message, a saved location, or by asking), then sends the closest providers'
// contact cards with an estimated rate. Paging state mirrors the goods flow so "more"
// works, with browseMode: 'services' always written alongside it.
type ServiceTarget = { query: string; categorySlug?: undefined } | { query?: undefined; categorySlug: string; categoryLabel: string }

async function runServiceSearchAndReply(
  waId: string,
  offset: number,
  target: ServiceTarget,
  locationFromMessage: BuyerLocation | null = null
): Promise<void> {
  await connectToDatabase()
  const state: any = await WhatsAppBrowseState.findOne({ waId }).lean()
  const label = target.categorySlug ? target.categoryLabel : serviceLabel(String(target.query))

  let location: BuyerLocation | null = locationFromMessage || (state?.buyerLocation as BuyerLocation | undefined) || null
  if (!location) {
    // Ask once, remembering what they asked for so the location reply completes the search.
    await WhatsAppBrowseState.findOneAndUpdate(
      { waId },
      {
        $set: {
          browseMode: 'services',
          stage: AWAITING_SERVICE_LOCATION_STAGE,
          pendingServiceQuery: target.query || '',
          pendingServiceCategorySlug: target.categorySlug || '',
          updatedAt: new Date(),
        },
        $unset: { lastQuery: '', lastCategorySlug: '', matchMode: '' },
      },
      { upsert: true }
    )
    await trySendText(waId, `Looking for "${label}". ${locationPrompt()}`)
    return
  }

  const matches = await findNearbyProviders(target.categorySlug ? { category: target.categorySlug } : { query: String(target.query) }, location)
  const baseUpdate = {
    browseMode: 'services',
    stage: 'browsing',
    ...(locationFromMessage && !locationFromMessage.unknown ? { buyerLocation: locationFromMessage } : {}),
    updatedAt: new Date(),
  }

  if (matches.length === 0) {
    console.log(`[whatsapp-buyer] service search: no providers for "${label}" near ${location.label} (offset ${offset}) — ${waId}`)
    // Fall through to products: "sneakers" typed while in services mode is still a
    // product search, not a dead end.
    if (offset === 0 && target.query && (await searchCatalogProducts(target.query, 0, 1)).length > 0) {
      await runSearchAndReply(waId, target.query, 0)
      return
    }
    await WhatsAppBrowseState.findOneAndUpdate(
      { waId },
      { $set: baseUpdate, $unset: { lastQuery: '', lastCategorySlug: '', pendingServiceQuery: '', pendingServiceCategorySlug: '' } },
      { upsert: true }
    )
    await trySendText(
      waId,
      offset > 0
        ? `No more providers for "${label}".`
        : `I couldn't find a "${label}" provider with a contact number yet. Try another name for the service, or type "categories" to browse.`
    )
    return
  }

  const pageItems = matches.slice(offset, offset + PROVIDERS_PER_PAGE)
  const hasMore = matches.length > offset + PROVIDERS_PER_PAGE
  if (pageItems.length === 0) {
    await trySendText(waId, `No more providers for "${label}".`)
    return
  }

  console.log(`[whatsapp-buyer] service search: sending ${pageItems.length} provider(s) for "${label}" near ${location.label} (offset ${offset}, hasMore ${hasMore}) — ${waId}`)

  if (offset === 0) {
    const nearest = pageItems[0]
    const intro = location.unknown
      ? `${label} providers (send your area any time and I'll sort them by distance):`
      : nearest.distanceKm != null
        ? `Closest ${label} providers to ${location.label}:`
        : `${label} providers (I couldn't work out distances from ${location.label}):`
    await trySendText(waId, intro)
  }

  await Promise.all([
    sendProviderCards(waId, pageItems),
    WhatsAppBrowseState.findOneAndUpdate(
      { waId },
      target.categorySlug
        ? {
            $set: { ...baseUpdate, lastCategorySlug: target.categorySlug, offset: offset + pageItems.length },
            $unset: { lastQuery: '', pendingServiceQuery: '', pendingServiceCategorySlug: '' },
          }
        : {
            $set: { ...baseUpdate, lastQuery: target.query, offset: offset + pageItems.length },
            $unset: { lastCategorySlug: '', pendingServiceQuery: '', pendingServiceCategorySlug: '' },
          },
      { upsert: true }
    ),
  ])

  await trySendText(
    waId,
    hasMore
      ? `Reply "more" for other providers, or send a different area to search elsewhere.`
      : location.unknown
        ? 'Those are all the providers I found. Send your area to find the closest ones.'
        : `Those are all the providers I found near ${location.label}. Send a different area to search elsewhere.`
  )
}

// The buyer's answer to "where are you?" after a service request. A recognised place
// completes the pending search; anything else gets one more nudge, and a fresh service
// request (e.g. they changed their mind: "actually a plumber") is honoured as such.
async function handleServiceLocationReply(waId: string, text: string, state: any): Promise<void> {
  const parsed = parseBuyerLocation(text)
  const pendingQuery = String(state?.pendingServiceQuery || '')
  const pendingSlug = String(state?.pendingServiceCategorySlug || '')
  const category = pendingSlug ? SERVICE_CATEGORIES.find((c) => c.slug === pendingSlug) : undefined
  const target: ServiceTarget | null = category
    ? { categorySlug: category.slug, categoryLabel: category.name }
    : pendingQuery ? { query: pendingQuery } : null

  if (!parsed) {
    const { query, location } = splitServiceQueryAndLocation(text)
    if (location && query) {
      await runServiceSearchAndReply(waId, 0, { query }, location)
      return
    }
    if (!target || /\b(skip|anywhere|any|all)\b/i.test(text)) {
      // No location we can use — clear the wait rather than trap them.
      await WhatsAppBrowseState.findOneAndUpdate(
        { waId },
        { $set: { stage: 'browsing', updatedAt: new Date() }, $unset: { pendingServiceQuery: '', pendingServiceCategorySlug: '' } },
        { upsert: true }
      )
      if (target) {
        // Show providers unsorted rather than nothing.
        await runServiceSearchAndReply(waId, 0, target, UNKNOWN_LOCATION)
        return
      }
      await trySendText(waId, SERVICE_GREETING_MESSAGE)
      return
    }
    await trySendText(waId, `I couldn't place "${text}" on the map. Send your city or area (e.g. "Yaba, Lagos" or "Wuse, Abuja"), share your location pin, or reply "skip" to see providers anywhere.`)
    return
  }

  if (!target) {
    await WhatsAppBrowseState.findOneAndUpdate(
      { waId },
      { $set: { buyerLocation: parsed, stage: 'browsing', browseMode: 'services', updatedAt: new Date() } },
      { upsert: true }
    )
    await trySendText(waId, `Got it — ${parsed.label}. What service do you need?`)
    return
  }
  await runServiceSearchAndReply(waId, 0, target, parsed)
}

// Called when the buyer shares a WhatsApp location pin (see handleInboundLocation in
// lib/whatsapp/commands.ts). Exact coordinates beat a city-centre guess.
export async function handleBuyerLocationPin(waId: string, lat: number, lng: number, name?: string): Promise<void> {
  await connectToDatabase()
  const state: any = await WhatsAppBrowseState.findOne({ waId }).lean()
  const location: BuyerLocation = { label: String(name || '').trim() || 'your location', lat, lng }
  const pendingQuery = String(state?.pendingServiceQuery || '')
  const pendingSlug = String(state?.pendingServiceCategorySlug || '')
  const category = pendingSlug ? SERVICE_CATEGORIES.find((c) => c.slug === pendingSlug) : undefined
  if (category) {
    await runServiceSearchAndReply(waId, 0, { categorySlug: category.slug, categoryLabel: category.name }, location)
    return
  }
  if (pendingQuery) {
    await runServiceSearchAndReply(waId, 0, { query: pendingQuery }, location)
    return
  }
  await WhatsAppBrowseState.findOneAndUpdate(
    { waId },
    { $set: { buyerLocation: location, stage: state?.stage === AWAITING_SERVICE_LOCATION_STAGE ? 'browsing' : state?.stage || 'browsing', updatedAt: new Date() } },
    { upsert: true }
  )
  await trySendText(waId, 'Thanks, I\'ve saved your location. Tell me what service you need and I\'ll find the closest providers.')
}

const RECENT_RESULTS_TTL_MS = 48 * 60 * 60 * 1000 // matches WhatsAppProductMessageMap's TTL

async function tryHandleRecentResultReference(waId: string, text: string, state: any): Promise<boolean> {
  const results: RecentResult[] = Array.isArray(state?.lastResults) ? state.lastResults : []
  const sentAt = state?.lastResultsAt ? new Date(state.lastResultsAt).getTime() : 0
  if (results.length === 0 || Date.now() - sentAt > RECENT_RESULTS_TTL_MS) return false

  const ref = parseResultReference(text, results)
  if (!ref) return false

  if (ref.kind === 'out_of_range') {
    await trySendText(waId, `I only sent ${results.length} item${results.length === 1 ? '' : 's'}:\n${listRecentResults(results)}\n\nReply with one of those numbers, or search again.`)
    return true
  }

  if (ref.kind === 'item') {
    const target = results[ref.index]
    console.log(`[whatsapp-buyer] recent-result reference "${text}" -> #${ref.index + 1} ${target.name} — ${waId}`)
    if (!ref.remainder) {
      // A bare "the first one" / "the red one" — confirm what that is before doing anything.
      await connectToDatabase()
      const product: any = await Product.findOne({ _id: target.productId }).select('name price description').lean()
      const description = String(product?.description || '').trim()
      await trySendText(
        waId,
        `${ref.index + 1}. ${target.name} — NGN ${Number(product?.price || 0).toLocaleString('en-NG')}${description ? `\n${description.slice(0, 200)}${description.length > 200 ? '…' : ''}` : ''}\n\nReply "add ${ref.index + 1}" to add it to your cart, or ask me anything about it.`
      )
      return true
    }
    await handleProductAction(waId, target.productId, ref.remainder)
    return true
  }

  // Ambiguous: several cards, no number. A price question can be answered for all of
  // them; anything else needs a pick.
  if (/\b(how much|price|cost)\b/i.test(ref.remainder)) {
    await connectToDatabase()
    const products: any[] = await Product.find({ _id: { $in: results.map((r) => r.productId) } }).select('name price').lean()
    const priceById = new Map(products.map((p) => [String(p._id), Number(p.price || 0)]))
    const lines = results.map((r, i) => `${i + 1}. ${r.name} — NGN ${(priceById.get(r.productId) ?? 0).toLocaleString('en-NG')}`)
    await trySendText(waId, `${lines.join('\n')}\n\nReply with a number (e.g. "2") to add one to your cart.`)
    return true
  }
  await trySendText(waId, `Which one?\n${listRecentResults(results)}\n\nReply with the number (e.g. "1"), or say it — "the ${results[0].name.split(' ')[0].toLowerCase()} one".`)
  return true
}

async function handleMoreCommand(waId: string): Promise<void> {
  await connectToDatabase()
  const state: any = await WhatsAppBrowseState.findOne({ waId }).lean()

  if (state?.matchMode) {
    // Dynamic import — image-search.ts pulls in TensorFlow.js (via lib/image-classify.ts),
    // which must not be a load-time dependency of this whole file (buyer.ts is imported by
    // lib/whatsapp/commands.ts, itself imported by the webhook route hit by EVERY inbound
    // message). Only actually loaded when a buyer is paging through image-search results.
    // Best-effort — a broken/missing native dependency (confirmed live: sharp's binary
    // failing to load on Vercel) must never crash "more" handling for the buyer.
    try {
      const { continueImageMatchPaging } = await import('@/lib/whatsapp/image-search')
      await continueImageMatchPaging(waId, state)
    } catch (error) {
      console.error('[whatsapp-buyer] Failed to load image search for paging:', error)
      await trySendText(waId, "Sorry, photo search isn't working right now — try searching by typing what you're looking for instead.")
    }
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
// 1. "cancel" — works at any non-browsing stage, checked first: clears a pending
//    "where are you?" service question, otherwise hands off to checkout's cancel.
// 2. Blocking checkout stages (awaiting_name/address/couriers/confirm/payment) own the
//    whole message — everything below is skipped entirely while mid-checkout. Goods-only
//    concept, unaffected by browseMode.
// 3. awaiting_service_location — the buyer asked for a service before saying where they
//    are, so the next message is read as a location first (a few navigation keywords
//    still pass through so nobody gets trapped).
// 4. Reply-to-a-product-or-provider-card — a reply is a stronger, more specific signal
//    than parsing the reply's text, so it's checked before any keyword. Tries goods first,
//    then services (lib/whatsapp/service-contacts.ts, which just re-sends the provider's
//    contact details) — a given message id only ever resolves in one of the two
//    message-map collections, so trying both in sequence is safe, not ambiguous.
// 5. "more" — mode-aware (handleMoreCommand branches on browseMode internally).
// 6. Category keywords — mode-aware: shows the services category menu instead of goods'
//    while browseMode is 'services'.
// 7. Services entry phrases ("services", "book a service", ...) — switch browseMode and
//    show the services category menu. Goods exit phrases ("shop", "products") switch back.
//    Both checked here, before any goods-specific keyword below, so they work regardless
//    of current mode.
// 8. Order-status query ("where is my order") — checked before checkout intent. Mode-
//    agnostic: order history is goods-only today, but answering it doesn't depend on
//    what the buyer is currently browsing.
// 9. "cart" / "remove N" / "checkout" — cart management,
//    goods-only, mode-agnostic for the same reason as order-status above.
// 10. Service booking-intent ("book", "reserve", "schedule", "appointment") with no
//     specific service context — only checked while browseMode is 'services'. Points the
//     buyer at replying to a specific service result (item 4 above), since that's the
//     actual way to book one; this is just the generic-keyword fallback when there's no
//     service to book yet. Placed after goods' buy-intent/checkout so a services-mode
//     buyer typing "buy" still reaches that existing goods path unmodified.
// 11. Comma-separated shopping list ("sneakers, iphone case") — sends choices for each
//     item without adding a guessed match to the cart.
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
  // stage" precedent as BLOCKING_CHECKOUT_STAGES further down.
  if (await tryHandleCustomerWithdrawalFlow(waId, trimmed)) return

  await connectToDatabase()
  const state: any = await WhatsAppBrowseState.findOne({ waId }).lean()
  const stage = String(state?.stage || 'browsing')
  const mode = String(state?.browseMode || 'goods')

  if (lower === 'cancel') {
    if (stage === AWAITING_SERVICE_LOCATION_STAGE) {
      await WhatsAppBrowseState.findOneAndUpdate(
        { waId },
        { $set: { stage: 'browsing', updatedAt: new Date() }, $unset: { pendingServiceQuery: '', pendingServiceCategorySlug: '' } },
        { upsert: true }
      )
      await trySendText(waId, "No problem. Tell me what you need whenever you're ready.")
      return
    }
    const handled = await handleCancelCommand(waId, stage)
    if (handled) return
  }

  if (BLOCKING_CHECKOUT_STAGES.has(stage)) {
    await handleCheckoutStageMessage(waId, trimmed, stage)
    return
  }

  if (stage === AWAITING_SERVICE_LOCATION_STAGE) {
    // Commands that should still work mid-question, so the wait never traps anyone.
    if (!(lower === 'more' || CATEGORY_KEYWORDS.has(lower) || SERVICE_ENTRY_KEYWORDS.has(lower) || GOODS_EXIT_KEYWORDS.has(lower) || GREETING_KEYWORDS.has(lower))) {
      await handleServiceLocationReply(waId, trimmed, state)
      return
    }
  }

  if (contextMessageId) {
    const handledProduct = await tryHandleProductReply(waId, contextMessageId, trimmed)
    if (handledProduct) return
    // A reply to a provider card just re-sends that provider's contact details — there is
    // no in-chat booking, offer or quote flow for services.
    const handledService = await tryHandleProviderCardReply(waId, contextMessageId, (state?.buyerLocation as BuyerLocation | undefined) || null)
    if (handledService) return
  }

  if (lower === 'more' || lower === 'next' || lower === 'show more' || lower === 'more results') {
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
      { $set: { browseMode: 'goods', updatedAt: new Date() }, $unset: { lastQuery: '', lastCategorySlug: '', matchMode: '' } },
      { upsert: true }
    )
    await trySendText(waId, GREETING_MESSAGE)
    return
  }

  if (ORDER_STATUS_PATTERN.test(trimmed) || /^(?:track(?:ing)?(?:\s+\S+)?|my orders?|orders?(?:\s+status)?)[\s?.!]*$/i.test(trimmed)) {
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

  if (CHECKOUT_INTENT_PATTERN.test(trimmed)) {
    await handleCheckoutStart(waId)
    return
  }

  if (mode === 'services' && /^(?:book|reserve|schedule|appointment)(?:\s+(?:this|one|it))?\s*[!.]?$/i.test(trimmed)) {
    await trySendText(waId, SERVICE_BOOKING_SOON_MESSAGE)
    return
  }

  if (mode === 'goods' && trimmed.includes(',')) {
    const handled = await searchShoppingList(waId, trimmed)
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

  // Delivery/payment/returns/support questions, acknowledgements, and "add"/"how much"
  // sent without replying to a card — none of these are product names.
  const hasRecentResults = Array.isArray(state?.lastResults) && state.lastResults.length > 0
  const faq = answerBuyerFaq(trimmed, { hasRecentResults })
  if (faq) {
    if (faq.kind === 'categories') {
      if (mode === 'services') await sendServiceCategoryMenu(waId)
      else await sendCategoryMenu(waId)
    } else {
      await trySendText(waId, faq.body)
    }
    return
  }

  // "2", "the first one", "add the red one", or just "yes"/"how much?" after cards were
  // sent — resolve against the cards the buyer is looking at (recent-results.ts).
  if (!contextMessageId && await tryHandleRecentResultReference(waId, trimmed, state)) return

  // A bare place name with nothing pending ("Lagos" after a failed search): remember it
  // for service ranking and ask what they need, instead of searching for "Lagos".
  if (mode !== 'services') {
    const bareLocation = parseBuyerLocation(trimmed)
    if (bareLocation && splitServiceQueryAndLocation(trimmed).query.toLowerCase() === trimmed.toLowerCase()) {
      await WhatsAppBrowseState.findOneAndUpdate({ waId }, { $set: { buyerLocation: bareLocation, updatedAt: new Date() } }, { upsert: true })
      await trySendText(waId, `Got it — ${bareLocation.label}. What do you need? A product (e.g. "sneakers") or a service (e.g. "plumber")?`)
      return
    }
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
    const item = requestedItem(trimmed)
    if (wantsBooking) {
      const serviceQuery = item?.replace(/^(?:book|hire|a booking for|a service(?: for)?|service(?: for)?)\s+/i, '').trim()
      if (serviceQuery && !/^(?:a|an|the)?\s*service$/i.test(serviceQuery)) {
        const { query, location } = splitServiceQueryAndLocation(serviceQuery)
        await runServiceSearchAndReply(waId, 0, { query }, location)
        return
      }
      await WhatsAppBrowseState.findOneAndUpdate(
        { waId },
        { $set: { browseMode: 'services', updatedAt: new Date() } },
        { upsert: true }
      )
      await trySendText(waId, SERVICE_GREETING_MESSAGE)
      return
    }
    if (item) {
      await runSearchAndReply(waId, item, 0)
      return
    }
    await trySendText(waId, CONVERSATIONAL_CLARIFY_MESSAGE)
    return
  }

  if (mode === 'services') {
    // A bare place name while in services mode ("Ikeja") re-targets the last search.
    const bareLocation = parseBuyerLocation(trimmed)
    const { query, location } = splitServiceQueryAndLocation(trimmed)
    if (bareLocation && !location) {
      const lastCategory = state?.lastCategorySlug ? SERVICE_CATEGORIES.find((c) => c.slug === state.lastCategorySlug) : undefined
      if (lastCategory) {
        await runServiceSearchAndReply(waId, 0, { categorySlug: lastCategory.slug, categoryLabel: lastCategory.name }, bareLocation)
        return
      }
      if (state?.lastQuery) {
        await runServiceSearchAndReply(waId, 0, { query: String(state.lastQuery) }, bareLocation)
        return
      }
      await WhatsAppBrowseState.findOneAndUpdate({ waId }, { $set: { buyerLocation: bareLocation, updatedAt: new Date() } }, { upsert: true })
      await trySendText(waId, `Got it — ${bareLocation.label}. What service do you need?`)
      return
    }
    await runServiceSearchAndReply(waId, 0, { query }, location)
    return
  }
  await runSearchAndReply(waId, trimmed, 0)
}
