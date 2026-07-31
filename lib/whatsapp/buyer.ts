// Buyer-facing WhatsApp flow — product search/browsing for an UNLINKED sender (i.e. not
// a linked vendor, see resolveLinkedVendor in lib/whatsapp/commands.ts). v1 is browsing
// only: no cart, no checkout, no payment. Every product read goes through the existing
// getProducts() (lib/mongodb-operations.ts) with status: 'active' explicitly passed, so
// this never surfaces inactive/out-of-stock inventory.
import connectToDatabase from '@/lib/mongodb'
import { getProducts } from '@/lib/mongodb-operations'
import { WhatsAppBrowseState } from '@/lib/models/WhatsAppBrowseState'
import { sendTextMessage, sendImageMessage, sendInteractiveListMessage, type WhatsAppListRow } from '@/lib/whatsapp/client'
import { PRODUCT_CATEGORIES } from '@/lib/product-categories'

const RESULTS_PER_PAGE = 4
// Fetch one extra beyond the display page so "are there more results" can be answered
// from this one query instead of a separate count query.
const FETCH_PER_PAGE = RESULTS_PER_PAGE + 1
// Meta's interactive list hard cap is 10 rows total across all sections combined.
const MAX_LIST_ROWS = 10

// Covers standard English greetings plus common Nigerian Pidgin ones — the reply is sent
// back in Pidgin regardless of which of these matched, per the bot's tone for buyers.
const GREETING_KEYWORDS = new Set([
  'hi', 'hello', 'hey', 'start', 'help',
  'howfar', 'how far', 'how far now',
  'wetin dey happen', 'wetin dey sup', 'wetin sup', 'wassup', 'whats up', "what's up", 'sup',
  'yo', 'good morning', 'good afternoon', 'good evening', 'gm',
])
const CATEGORY_KEYWORDS = new Set(['menu', 'categories', 'category'])
// Conservative: only treated as buy-intent on short messages, so a legitimate longer
// product search that happens to contain one of these words (rare, but possible) isn't
// misrouted to the placeholder.
const BUY_INTENT_PATTERN = /\b(buy|purchase|checkout|order)\b/i
const BUY_INTENT_MAX_LENGTH = 40

// Pidgin greeting — doubles as the "what are you here for" prompt so a first-time buyer
// who has no idea what to type gets pointed straight at the two things they actually can
// do (search by name, or browse categories).
const GREETING_MESSAGE =
  'How far! Welcome to Make It Sell — I fit help you find something to buy sharp sharp.\n\nWetin you dey find today? Type the product name (e.g. "blue sneakers") make I show you, or type "categories" make I show you everything wey dey.'

const BUY_PLACEHOLDER_MESSAGE =
  "Ordering through WhatsApp isn't available yet — that's coming soon. For now, please complete your purchase on the Make It Sell website or app."

// Every reply goes through one of these so a delivery failure never throws back up into
// the webhook handler — matches the trySend discipline in lib/whatsapp/commands.ts.
async function trySendText(waId: string, body: string): Promise<void> {
  try {
    await sendTextMessage(waId, body)
  } catch (error) {
    console.error(`[whatsapp-buyer] Text send failed for ${waId}:`, error)
  }
}

async function trySendImage(waId: string, imageUrl: string, caption: string): Promise<void> {
  try {
    await sendImageMessage(waId, imageUrl, caption)
  } catch (error) {
    console.error(`[whatsapp-buyer] Image send failed for ${waId}:`, error)
  }
}

async function trySendList(waId: string, bodyText: string, buttonText: string, rows: WhatsAppListRow[]): Promise<void> {
  try {
    await sendInteractiveListMessage(waId, bodyText, buttonText, rows)
  } catch (error) {
    console.error(`[whatsapp-buyer] List send failed for ${waId}:`, error)
  }
}

function formatNaira(amount: number): string {
  return `NGN ${Math.max(0, Number(amount) || 0).toLocaleString('en-NG')}`
}

// Cloudinary images are plain public res.cloudinary.com URLs (unsigned upload flow, no
// authenticated delivery type anywhere in this codebase) — directly fetchable by
// WhatsApp. Inserting a transform keeps the file well under WhatsApp's 5MB image limit;
// no-op for anything that isn't a Cloudinary /upload/ URL (e.g. a non-Cloudinary image
// host, however unlikely in this codebase today).
function buildWhatsAppImageUrl(url: string): string {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url
  return url.replace('/upload/', '/upload/w_800,q_auto,f_auto/')
}

function buildProductCaption(product: any): string {
  const name = String(product?.name || 'Product')
  const price = formatNaira(Number(product?.price || 0))
  const vendorName = String(product?.vendorName || 'Make It Sell')
  return `${name}\n${price}\nSold by ${vendorName}`
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

  for (const product of pageItems) {
    const caption = buildProductCaption(product)
    const rawImage = Array.isArray(product?.images) ? product.images[0] : undefined
    if (rawImage) {
      await trySendImage(waId, buildWhatsAppImageUrl(rawImage), caption)
    } else {
      // No product photo on file — fall back to text so the listing still shows up
      // rather than silently disappearing from the results.
      await trySendText(waId, caption)
    }
  }

  await WhatsAppBrowseState.findOneAndUpdate(
    { waId },
    { $set: { lastQuery: query, offset: offset + pageItems.length, updatedAt: new Date() } },
    { upsert: true }
  )

  if (hasMore) {
    await trySendText(waId, `Reply "more" to see more results for "${query}".`)
  }
}

async function handleMoreCommand(waId: string): Promise<void> {
  await connectToDatabase()
  const state: any = await WhatsAppBrowseState.findOne({ waId }).lean()
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
// the restructured handleInboundMessage in lib/whatsapp/commands.ts. Simplification, made
// transparently rather than tracked as true "is this their first-ever message": greeting
// fires off a small keyword set (hi/hello/hey/start/help) plus an empty message, not a
// genuine first-contact check.
export async function handleBuyerMessage(waId: string, text: string): Promise<void> {
  const trimmed = String(text || '').trim()
  const lower = trimmed.toLowerCase()

  if (!trimmed || GREETING_KEYWORDS.has(lower)) {
    await trySendText(waId, GREETING_MESSAGE)
    return
  }

  if (CATEGORY_KEYWORDS.has(lower)) {
    await sendCategoryMenu(waId)
    return
  }

  if (lower === 'more') {
    await handleMoreCommand(waId)
    return
  }

  if (trimmed.length <= BUY_INTENT_MAX_LENGTH && BUY_INTENT_PATTERN.test(trimmed)) {
    await trySendText(waId, BUY_PLACEHOLDER_MESSAGE)
    return
  }

  await runSearchAndReply(waId, trimmed, 0)
}
