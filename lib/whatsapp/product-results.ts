// Shared product-result presentation — image+caption sends with store-name resolution
// and reply-to-select tracking. Used by both text search (lib/whatsapp/buyer.ts) and
// photo-based search (lib/whatsapp/image-search.ts); split into its own module so
// neither of those two needs to import the other.
import connectToDatabase from '@/lib/mongodb'
import { Store } from '@/lib/models/Store'
import { sendTextMessage, sendImageMessage } from '@/lib/whatsapp/client'
import { WhatsAppBrowseState } from '@/lib/models/WhatsAppBrowseState'
import type { RecentResult } from '@/lib/whatsapp/recent-results'
import { trackProductMessage } from '@/lib/whatsapp/checkout'

async function trySendText(waId: string, body: string): Promise<any | null> {
  try {
    return await sendTextMessage(waId, body)
  } catch (error) {
    console.error(`[whatsapp-product-results] Text send failed for ${waId}:`, error)
    return null
  }
}

async function trySendImage(waId: string, imageUrl: string, caption: string): Promise<any | null> {
  try {
    return await sendImageMessage(waId, imageUrl, caption)
  } catch (error) {
    console.error(`[whatsapp-product-results] Image send failed for ${waId}:`, error)
    return null
  }
}

function formatNaira(amount: number): string {
  return `NGN ${Math.max(0, Number(amount) || 0).toLocaleString('en-NG')}`
}

// Cloudinary images are plain public res.cloudinary.com URLs (unsigned upload flow, no
// authenticated delivery type anywhere in this codebase) — directly fetchable by
// WhatsApp. Inserting a transform keeps the file well under WhatsApp's 5MB image limit;
// no-op for anything that isn't a Cloudinary /upload/ URL.
function buildWhatsAppImageUrl(url: string): string {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url
  return url.replace('/upload/', '/upload/w_800,q_auto,f_auto/')
}

// `storeName` is the vendor's actual STORE brand (e.g. "Munch"), resolved by the caller
// from a batched Store lookup — falls back to Product.vendorName (the vendor's personal
// account name, denormalized on the product at creation time) only if that lookup
// couldn't resolve one, so a caption is never blank.
function buildProductCaption(product: any, storeName: string | undefined, index: number): string {
  const name = String(product?.name || 'Product')
  const price = formatNaira(Number(product?.price || 0))
  const sellerName = storeName || String(product?.vendorName || 'Make It Sell')
  return `${index}. ${name}\n${price}\nSold by ${sellerName}\n\nReply "${index}" or "add ${index}" to add it to your cart.`
}

// Sends one result (image+caption, or text if no photo) and records the message->product
// mapping so a later reply to it can be resolved back to this product (checkout.ts's
// tryHandleProductReply — the primary add-to-cart path).
async function sendResultItem(waId: string, product: any, storeName: string | undefined, index: number): Promise<RecentResult | null> {
  const caption = buildProductCaption(product, storeName, index)
  const rawImage = Array.isArray(product?.images) ? product.images[0] : undefined
  const productId = String(product?.id || product?._id || '')

  const result = rawImage
    ? (await trySendImage(waId, buildWhatsAppImageUrl(rawImage), caption)) || await trySendText(waId, caption)
    : await trySendText(waId, caption)
  const messageId = String(result?.messages?.[0]?.id || '').trim()
  if (messageId && productId) {
    await trackProductMessage(waId, messageId, productId)
  }
  return productId ? { id: productId, kind: 'product', messageId, name: String(product?.name || 'Product'), price: Number(product?.price || 0) } : null
}

// Batch-resolves store names for a page of products, then sends them all concurrently.
// Each send catches its own errors, so one failure can't fail the whole batch.
// Cards are numbered so the buyer can say "2" or "the second one" instead of replying to
// the message. `append` keeps numbering (and memory) going across a shopping-list send.
export async function sendProductResults(waId: string, products: any[], options: { append?: boolean } = {}): Promise<void> {
  const storeIds = Array.from(new Set(products.map((p) => String((p as any)?.storeId || '')).filter(Boolean)))
  const stores = storeIds.length > 0 ? await Store.find({ _id: { $in: storeIds } }).select('storeName').lean() : []
  const storeNameById = new Map((stores as any[]).map((s) => [String(s._id), String(s.storeName || '')]))

  await connectToDatabase()
  const previous: RecentResult[] = options.append
    ? (((await WhatsAppBrowseState.findOne({ waId }).select('lastResults').lean()) as any)?.lastResults || [])
    : []
  const offset = previous.length

  // Sequential, not Promise.all: WhatsApp delivers in send order only when we send in
  // order, and the numbering has to match what the buyer sees.
  const sent: RecentResult[] = []
  for (let i = 0; i < products.length; i++) {
    const product = products[i]
    const item = await sendResultItem(waId, product, storeNameById.get(String((product as any)?.storeId || '')), offset + i + 1)
    if (item) sent.push(item)
  }
  await WhatsAppBrowseState.findOneAndUpdate(
    { waId },
    { $set: { lastResults: [...previous, ...sent].slice(-12), lastResultsAt: new Date(), updatedAt: new Date() } },
    { upsert: true }
  ).catch((error: unknown) => console.error(`[whatsapp-product-results] failed to remember results for ${waId}:`, error))
}
