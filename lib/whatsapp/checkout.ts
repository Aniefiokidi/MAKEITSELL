// WhatsApp checkout conversation (Phase 3 v2 core) — everything from "add this to my
// cart" through to a Paystack payment link. Scope is the purchase flow only; abandonment
// follow-up / auto-expire is a separate, later pass.
//
// Money-path discipline: this file NEVER computes a price/fee itself for what gets
// charged, and never talks to Shipbubble or Paystack directly.
// - getDeliveryQuotesForCart (lib/delivery-quotes.ts) is the only Shipbubble caller —
//   the exact function the website's rate-fetch route also calls.
// - initiateWaBuyerPaystackCheckout (lib/whatsapp/buyer-orders.ts) is the only path to
//   an actual order + Paystack link, and it internally calls buildOrder (lib/order-
//   creation.ts) — the SAME function app/api/payments/initialize/route.ts calls for web
//   orders — plus the same calculatePaystackCheckoutAmounts/paystackService the web
//   route uses. The order/VAT/shipping totals shown to the buyer before confirming are
//   recomputed here for DISPLAY only, using the identical formula; buildOrder is always
//   the authoritative source of what's actually charged.
import mongoose from 'mongoose'
import { Order } from '@/lib/models/Order'
import { answerBuyerFaq } from '@/lib/whatsapp/buyer-faq'
import { findPlaceInText } from '@/lib/geo-utils'
import { after } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { Product } from '@/lib/models/Product'
import { User } from '@/lib/models/User'
import { WhatsAppBrowseState } from '@/lib/models/WhatsAppBrowseState'
import { WhatsAppProductMessageMap } from '@/lib/models/WhatsAppProductMessageMap'
import { WhatsAppBuyer } from '@/lib/models/WhatsAppBuyer'
import { SavedAddress } from '@/lib/models/SavedAddress'
import { sendTextMessage, sendTemplateMessage, sendInteractiveListMessage, type WhatsAppListRow } from '@/lib/whatsapp/client'
import { findOrCreateBuyerForWaId, setBuyerName, placeholderEmailForWaId, PLACEHOLDER_BUYER_NAME } from '@/lib/whatsapp/buyer-identity'
import { initiateWaBuyerPaystackCheckout } from '@/lib/whatsapp/buyer-orders'
import { getDeliveryQuotesForCart } from '@/lib/delivery-quotes'
import { answerProductQuestion, selectProductVariants } from '@/lib/whatsapp/product-answers'
import { canonicalSelectedVariantsKey, normalizeProductVariants } from '@/lib/product-variants'

// Stages that own the buyer's very next message entirely — the normal browsing/search
// dispatch in lib/whatsapp/buyer.ts is bypassed while in one of these. 'cart' is
// deliberately NOT here: a buyer with items in cart can still search, browse categories,
// or add more, exactly like plain browsing.
// 'awaiting_payment' is deliberately NOT blocking: a buyer with an unpaid order can
// still browse, ask questions, or re-request the link — see tryHandleAwaitingPayment.
export const BLOCKING_CHECKOUT_STAGES = new Set([
  'awaiting_name',
  'choosing_saved_address',
  'awaiting_address',
  'quoting_delivery',
  'choosing_couriers',
  'confirming_total',
])

async function trySendText(waId: string, body: string): Promise<void> {
  try {
    await sendTextMessage(waId, body)
  } catch (error) {
    console.error(`[whatsapp-checkout] Text send failed for ${waId}:`, error)
  }
}

async function trySendList(waId: string, bodyText: string, buttonText: string, rows: WhatsAppListRow[]): Promise<void> {
  try {
    await sendInteractiveListMessage(waId, bodyText, buttonText, rows)
  } catch (error) {
    console.error(`[whatsapp-checkout] List send failed for ${waId}:`, error)
  }
}

function formatNaira(amount: number): string {
  return `NGN ${Math.max(0, Number(amount) || 0).toLocaleString('en-NG')}`
}

async function loadState(waId: string): Promise<any> {
  await connectToDatabase()
  return WhatsAppBrowseState.findOne({ waId }).lean()
}

async function saveState(waId: string, patch: Record<string, any>): Promise<void> {
  await connectToDatabase()
  await WhatsAppBrowseState.findOneAndUpdate(
    { waId },
    { $set: { ...patch, updatedAt: new Date() } },
    { upsert: true }
  )
}

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

async function addProductToCart(
  waId: string,
  product: any,
  quantity: number,
  selectedVariants: Array<{ label: string; value: string }>,
  state: any
): Promise<{ cart: any[]; addedTitle: string }> {
  const cart: any[] = Array.isArray(state?.cart) ? [...state.cart] : []

  const productId = String(product?.id || product?._id || '')
  const selectedKey = canonicalSelectedVariantsKey(selectedVariants)
  const existingIndex = cart.findIndex((item) =>
    String(item.productId) === productId && canonicalSelectedVariantsKey(item.selectedVariants) === selectedKey
  )

  if (existingIndex >= 0) {
    cart[existingIndex] = { ...cart[existingIndex], quantity: Number(cart[existingIndex].quantity || 1) + quantity }
  } else {
    cart.push({
      productId,
      vendorId: String(product?.vendorId || ''),
      vendorName: String(product?.vendorName || ''),
      storeId: String(product?.storeId || ''),
      title: String(product?.name || 'Product'),
      price: Number(product?.price || 0),
      quantity,
      selectedVariants,
    })
  }

  // Only ever upgrades browsing -> cart; never overrides a further-along stage (e.g. a
  // stray add attempt mid-checkout shouldn't silently reset progress — see the
  // dispatcher in lib/whatsapp/buyer.ts, which only reaches this function at all when
  // stage is 'browsing' or 'cart').
  const nextStage = (!state?.stage || state.stage === 'browsing') ? 'cart' : state.stage
  await saveState(waId, { cart, stage: nextStage })

  return { cart, addedTitle: String(product?.name || 'Product') }
}

function cartSubtotal(cart: any[]): number {
  return cart.reduce((sum, item) => sum + Number(item?.price || 0) * Number(item?.quantity || 1), 0)
}

// Called from lib/whatsapp/buyer.ts's send loop for every product image sent, so a later
// reply quoting that message can be resolved back to a product.
export async function trackProductMessage(waId: string, messageId: string, productId: string): Promise<void> {
  if (!messageId || !productId) return
  try {
    await connectToDatabase()
    await WhatsAppProductMessageMap.create({ messageId, productId, waId })
  } catch (error) {
    console.error(`[whatsapp-checkout] Failed to persist product message map for ${waId}:`, error)
  }
}

// Primary add-to-cart path: buyer replies (quotes) one of our product-result messages.
// Requires an explicit add instruction or quantity. Buyers often reply to a listing
// with a question, which must not silently change their cart.
export async function tryHandleProductReply(waId: string, contextMessageId: string, text: string): Promise<boolean> {
  await connectToDatabase()
  const mapping: any = await WhatsAppProductMessageMap.findOne({ messageId: contextMessageId, waId }).lean()
  if (!mapping?.productId) return false
  await handleProductAction(waId, String(mapping.productId), text)
  return true
}

// The same add/question handling for a product the buyer referred to by number or name
// ("2", "the red one" — lib/whatsapp/recent-results.ts) rather than by replying to it.
export async function handleProductAction(waId: string, productId: string, text: string): Promise<void> {
  await connectToDatabase()
  const product: any = await Product.findOne({ _id: productId, status: 'active' }).lean()
  if (!product) {
    await trySendText(waId, "Sorry, that item isn't available anymore. Search again to see what's in stock.")
    return
  }

  const trimmedReply = String(text || '').trim()
  const addMatch = trimmedReply.match(/^(?:add|buy|i(?:'d| would)? like|i want|yes|one|this)(?:\s+(\d+))?(?:\s+(.*))?$/i)
  const quantityText = /^\d+$/.test(trimmedReply) ? trimmedReply : addMatch?.[1]
  const optionReply = addMatch?.[2]?.replace(/[!.]+$/, '').trim() || ''
  const hasVariants = normalizeProductVariants(product).length > 0
  const hasUnexpectedWords = optionReply && !/^(?:this|one|it|to cart)$/i.test(optionReply) && !hasVariants
  if (trimmedReply && (!quantityText && !addMatch || hasUnexpectedWords)) {
    const answer = answerProductQuestion(product, trimmedReply)
    if (/You can ask about price, stock, colors, sizes, or delivery/.test(answer)) {
      // The generic fallback — we didn't really answer. Logged per product so sellers
      // can be told what buyers keep asking (digest -> catalog quality).
      import('@/lib/whatsapp/conversation-log').then(({ recordOutcome }) =>
        recordOutcome(waId, 'product_question_unanswered', { productId: String(product._id), productName: product.name, question: trimmedReply })
      ).catch(() => {})
    }
    await trySendText(waId, answer)
    return
  }
  const quantity = quantityText ? Number(quantityText) : 1
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) {
    await trySendText(waId, 'Please choose a quantity from 1 to 99.')
    return
  }
  const currentStock = Number(product.stock)
  if (currentStock !== 9999 && (!Number.isFinite(currentStock) || currentStock < quantity)) {
    if (!(currentStock > 0)) {
      const { watchStock } = await import('@/lib/whatsapp/proactive')
      await watchStock(waId, product)
    }
    await trySendText(waId, currentStock > 0
      ? `Only ${currentStock} unit${currentStock === 1 ? '' : 's'} of ${product.name} are currently listed. Reply with a smaller quantity.`
      : `${product.name} is out of stock right now — I'll message you here the moment it's back. Want something similar in the meantime?`)
    return
  }

  const variants = normalizeProductVariants(product)
  const variantSelection = selectProductVariants(product.name, variants, optionReply, quantity)
  if (variantSelection.prompt) {
    let prompt = variantSelection.prompt
    if (/^Choose Size/i.test(prompt)) {
      const { recallBuyer } = await import('@/lib/whatsapp/buyer-memory')
      const memory = await recallBuyer(waId)
      const remembered = String(memory?.preferredSize || '').replace(/^(?:UK|EU|US)\s*/i, '')
      const inStock = remembered && variants.find((v) => /size/i.test(v.label) && String(v.value).toUpperCase() === remembered.toUpperCase() && Number(v.stock) > 0)
      if (inStock) prompt += ` You took ${inStock.value} last time — reply "add Size ${inStock.value}" to use it.`
    }
    await trySendText(waId, prompt)
    return
  }

  const state = await loadState(waId)
  const cart: any[] = Array.isArray(state?.cart) ? state.cart : []
  // (productId is the function argument; product._id resolves to the same value)
  const existingProductQuantity = cart
    .filter((item) => String(item.productId) === productId)
    .reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  if (currentStock !== 9999 && existingProductQuantity + quantity > currentStock) {
    await trySendText(waId, `Your cart already has ${existingProductQuantity} of ${product.name}. Only ${currentStock} units are currently listed.`)
    return
  }
  const selectedKey = canonicalSelectedVariantsKey(variantSelection.selected)
  const existingVariantQuantity = cart
    .filter((item) => String(item.productId) === productId && canonicalSelectedVariantsKey(item.selectedVariants) === selectedKey)
    .reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  const unavailable = variantSelection.selected.find((selected) => {
    const variant = variants.find((entry) => entry.label === selected.label && entry.value === selected.value)
    return !variant || existingVariantQuantity + quantity > variant.stock
  })
  if (unavailable) {
    await trySendText(waId, `Your cart already has ${existingVariantQuantity} of ${product.name} (${unavailable.label}: ${unavailable.value}). Choose a smaller quantity or another option.`)
    return
  }

  const productWithId = { ...product, id: String(product._id) }
  const { cart: updatedCart, addedTitle } = await addProductToCart(waId, productWithId, quantity, variantSelection.selected, state)

  await trySendText(
    waId,
    `Added: ${addedTitle}${variantSelection.selected.length ? ` (${variantSelection.selected.map((variant) => `${variant.label}: ${variant.value}`).join(', ')})` : ''} x${quantity}\n\nCart: ${updatedCart.length} item(s), ${formatNaira(cartSubtotal(updatedCart))}. Type "cart" to view, "checkout" when ready, or keep searching.`
  )
}

// The cart as text — used for the buyer's "cart" reply and for a support agent
// looking at a handed-off buyer's cart from their own phone.
export async function describeCart(waId: string): Promise<string> {
  const state = await loadState(waId)
  const cart: any[] = Array.isArray(state?.cart) ? state.cart : []
  if (cart.length === 0) return 'Cart is empty.'
  const lines = cart.map((item, i) => `${i + 1}. ${item.title}${Array.isArray(item.selectedVariants) && item.selectedVariants.length ? ` (${item.selectedVariants.map((variant: any) => `${variant.label}: ${variant.value}`).join(', ')})` : ''} x${item.quantity} — ${formatNaira(Number(item.price || 0) * Number(item.quantity || 1))}`)
  return `${lines.join('\n')}\nSubtotal: ${formatNaira(cartSubtotal(cart))}${state?.stage && state.stage !== 'browsing' ? `\nStage: ${state.stage}` : ''}`
}

export async function sendCartSummary(waId: string): Promise<void> {
  const state = await loadState(waId)
  const cart: any[] = Array.isArray(state?.cart) ? state.cart : []

  if (cart.length === 0) {
    await trySendText(waId, 'Your cart is empty. Search for a product and reply to a result to add it.')
    return
  }

  const lines = cart.map((item, i) => `${i + 1}. ${item.title}${Array.isArray(item.selectedVariants) && item.selectedVariants.length ? ` (${item.selectedVariants.map((variant: any) => `${variant.label}: ${variant.value}`).join(', ')})` : ''} x${item.quantity} — ${formatNaira(Number(item.price || 0) * Number(item.quantity || 1))}`)

  await trySendText(
    waId,
    `Your cart:\n${lines.join('\n')}\n\nSubtotal: ${formatNaira(cartSubtotal(cart))}\n\nReply "checkout" to continue, "remove <#>" to remove an item, or keep searching to add more.`
  )
}

// "remove it", "remove the sneakers", "remove the last one" — resolve to a cart index.
// Returns null when nothing in the cart matches.
export async function resolveCartIndex(waId: string, reference: string): Promise<{ index: number; cart: any[] } | null> {
  const state = await loadState(waId)
  const cart: any[] = Array.isArray(state?.cart) ? state.cart : []
  if (cart.length === 0) return null
  const ref = reference.trim().toLowerCase()
  if (!ref || /^(?:it|that|this|the last one|last one|the last|the item)$/.test(ref)) return { index: cart.length, cart }
  if (/^(?:the first one|first one|the first)$/.test(ref)) return { index: 1, cart }
  const numeric = ref.match(/^(?:item |#|number |no\.? )?(\d{1,2})$/)
  if (numeric) return { index: Number(numeric[1]), cart }
  const words = ref.replace(/^(?:the|my)\s+/, '').split(/\s+/).filter((w) => w.length > 2)
  const hits = cart.map((item, i) => ({ i: i + 1, title: String(item?.title || '').toLowerCase() })).filter((c) => words.some((w) => c.title.includes(w)))
  if (hits.length === 1) return { index: hits[0].i, cart }
  if (cart.length === 1) return { index: 1, cart }
  return null
}

export async function clearCart(waId: string): Promise<void> {
  await saveState(waId, { cart: [], stage: 'browsing' })
  await trySendText(waId, 'Done — your cart is empty. Tell me what you\'d like to look for next.')
}

// "make it 3", "change quantity to 3", "I want 3 instead"
export async function setCartQuantity(waId: string, index: number, quantity: number): Promise<void> {
  const state = await loadState(waId)
  const cart: any[] = Array.isArray(state?.cart) ? [...state.cart] : []
  if (!Number.isInteger(index) || index < 1 || index > cart.length) {
    await trySendText(waId, 'Which item? Type "cart" to see the list, then e.g. "change item 2 to 3".')
    return
  }
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) {
    await trySendText(waId, 'Please choose a quantity from 1 to 99.')
    return
  }
  const item = cart[index - 1]
  await connectToDatabase()
  const product: any = await Product.findOne({ _id: item.productId }).select('name stock').lean()
  const stock = Number(product?.stock)
  if (product && stock !== 9999 && Number.isFinite(stock) && stock < quantity) {
    await trySendText(waId, `Only ${stock} unit${stock === 1 ? '' : 's'} of ${item.title} are listed. Reply with a smaller quantity.`)
    return
  }
  cart[index - 1] = { ...item, quantity }
  await saveState(waId, { cart })
  await trySendText(waId, `Updated: ${item.title} x${quantity}.\n\nCart: ${cart.length} item(s), ${formatNaira(cartSubtotal(cart))}. Type "checkout" when ready.`)
}

export async function handleRemoveCommand(waId: string, index: number): Promise<void> {
  const state = await loadState(waId)
  const cart: any[] = Array.isArray(state?.cart) ? [...state.cart] : []

  if (!Number.isInteger(index) || index < 1 || index > cart.length) {
    await trySendText(waId, `I couldn't find item #${index} in your cart. Type "cart" to see the current list.`)
    return
  }

  const [removed] = cart.splice(index - 1, 1)
  await saveState(waId, { cart, stage: cart.length === 0 ? 'browsing' : 'cart' })

  await trySendText(
    waId,
    `Removed: ${removed?.title || 'item'}. ${cart.length === 0 ? 'Your cart is now empty.' : `${cart.length} item(s) left in your cart.`}`
  )
}

// Explicit cancel — clears ALL checkout progress back to browsing. Works from 'cart' too
// (clears the cart, not just a blocking stage), never from plain 'browsing' (nothing to
// cancel there, so the caller should let the message fall through to normal dispatch).
export async function handleCancelCommand(waId: string, stage: string): Promise<boolean> {
  if (!stage || stage === 'browsing') return false

  await saveState(waId, {
    stage: 'browsing',
    cart: [],
    pendingShippingInfo: {},
    pendingShippingInfoFromSavedId: null,
    deliveryQuotes: {},
    selectedCouriers: {},
    pendingOrderId: null,
    pendingPaymentUrl: null,
    pendingPaymentTotal: null,
  })
  await trySendText(waId, 'Checkout cancelled — your cart has been cleared. Search for a product to start again.')
  return true
}

// ---------------------------------------------------------------------------
// Checkout: name -> address -> quotes -> couriers -> confirm -> pay
// ---------------------------------------------------------------------------

const ADDRESS_PROMPT =
  'What\'s your delivery address? Please send it as 4 lines (or separate with commas):\n\nStreet address\nCity\nState\nDelivery note (e.g. nearest landmark or gate info)\n\nExample:\n12 Allen Avenue\nIkeja\nLagos\nBlue gate opposite the bank'

async function beginAddressCollection(waId: string): Promise<void> {
  await saveState(waId, { stage: 'awaiting_address' })
  await trySendText(waId, ADDRESS_PROMPT)
}

// Shows saved addresses as a native list picker (same mechanism as the category menu,
// see lib/whatsapp/buyer.ts's sendCategoryMenu) plus an "Add new address" row. Returns
// false (and sends nothing) when the buyer has no saved addresses, so the caller can fall
// straight through to the existing free-text collection flow.
async function presentSavedAddressPicker(waId: string, customerId: string): Promise<boolean> {
  await connectToDatabase()
  const doc: any = await SavedAddress.findOne({ userId: customerId }).lean()
  const addresses: any[] = doc?.addresses || []
  if (addresses.length === 0) return false

  // Meta's interactive list hard-caps at 10 rows total — reserve one for "Add new".
  const rows: WhatsAppListRow[] = addresses.slice(0, 9).map((a) => ({
    id: `address:${a._id}`,
    title: String(a.label || 'Address').slice(0, 24),
    description: `${a.address}, ${a.city}`.slice(0, 72),
  }))
  rows.push({ id: 'address:new', title: 'Add new address', description: 'Enter a different delivery address' })

  await saveState(waId, { stage: 'choosing_saved_address' })
  await trySendList(waId, 'Choose a delivery address:', 'Addresses', rows)
  return true
}

// Handles a tap on the picker above — called from the webhook's list_reply branch for
// any row id prefixed "address:" (as opposed to "category:", handled by
// lib/whatsapp/buyer.ts's handleCategorySelection).
export async function handleSavedAddressListReply(waId: string, rowId: string): Promise<void> {
  const idPart = rowId.replace(/^address:/, '')

  if (idPart === 'new') {
    await beginAddressCollection(waId)
    return
  }

  const { customerId } = await findOrCreateBuyerForWaId(waId)
  await connectToDatabase()
  const doc: any = await SavedAddress.findOne({ userId: customerId }).lean()
  const addr = (doc?.addresses || []).find((a: any) => String(a._id) === idPart)

  if (!addr) {
    await trySendText(waId, "Couldn't find that saved address — let's try again.")
    await beginAddressCollection(waId)
    return
  }

  const parsed = { address: addr.address, city: addr.city, state: addr.state, deliveryInstructions: addr.deliveryInstructions || '' }
  // Marks this address as already-saved so handleConfirmReply's auto-save skips it.
  await saveState(waId, { stage: 'quoting_delivery', pendingShippingInfo: parsed, pendingShippingInfoFromSavedId: idPart })
  await trySendText(waId, 'One moment, checking delivery options for your address...')
  await fetchAndPresentQuotes(waId, parsed)
}

// Entry point for the "checkout" keyword / buy-intent messages from lib/whatsapp/buyer.ts.
export async function handleCheckoutStart(waId: string): Promise<void> {
  const state = await loadState(waId)
  const cart: any[] = Array.isArray(state?.cart) ? state.cart : []

  if (cart.length === 0) {
    await trySendText(waId, 'Your cart is empty — search for a product and reply to one of the results to add it, then type "checkout".')
    return
  }

  // An earlier order is still waiting for payment — don't silently start another.
  if (state?.stage === 'awaiting_payment' && state?.pendingOrderId) {
    const unpaid = await pendingOrderStatus(state.pendingOrderId)
    if (unpaid === 'unpaid') {
      await trySendText(
        waId,
        `You still have an unpaid order ${String(state.pendingOrderId).slice(0, 8).toUpperCase()}${state.pendingPaymentTotal ? ` for ${formatNaira(Number(state.pendingPaymentTotal))}` : ''}:\n${state.pendingPaymentUrl || ''}\n\nPay it and we'll continue, or reply "cancel" to drop it and check out this cart instead.`
      )
      return
    }
  }

  const { customerId } = await findOrCreateBuyerForWaId(waId)
  const buyer: any = await User.findById(customerId).lean()

  if (!buyer?.name || buyer.name === PLACEHOLDER_BUYER_NAME) {
    await saveState(waId, { stage: 'awaiting_name' })
    await trySendText(waId, "What's your name? (So we know who's ordering — we'll remember it for next time.)")
    return
  }

  const shownPicker = await presentSavedAddressPicker(waId, customerId)
  if (!shownPicker) {
    await beginAddressCollection(waId)
  }
}

async function handleNameReply(waId: string, text: string): Promise<void> {
  const trimmed = String(text || '').trim()
  if (!trimmed || trimmed.length > 60 || /\d/.test(trimmed)) {
    await trySendText(waId, 'Just your name, please (e.g. "David Okafor").')
    return
  }
  await setBuyerName(waId, trimmed)
  await beginAddressCollection(waId)
}

// Accepts the 4-line/4-comma format the prompt asks for, but also what people actually
// send: three parts without a note, two parts ("12 Allen Avenue, Ikeja"), or one line
// ("12 Allen Avenue Ikeja Lagos") — the city/state are recognised from the known-places
// list (lib/geo-utils.ts) and the street is whatever comes before them.
function parseAddressReply(text: string): { address: string; city: string; state: string; deliveryInstructions: string } | null {
  const trimmed = String(text || '').trim()
  if (!trimmed) return null

  let parts = trimmed.split('\n').map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) parts = trimmed.split(/,|;/).map((p) => p.trim()).filter(Boolean)

  // Order creation (lib/order-creation.ts) requires a non-empty delivery note, so a
  // buyer who didn't give one gets a sensible default rather than a failed order.
  const DEFAULT_NOTE = 'Call on arrival'
  if (parts.length >= 4) {
    const [address, city, state, ...rest] = parts
    return { address, city, state, deliveryInstructions: rest.join(', ') || DEFAULT_NOTE }
  }
  if (parts.length === 3) {
    const [address, city, state] = parts
    return { address, city, state, deliveryInstructions: DEFAULT_NOTE }
  }
  if (parts.length === 2) {
    const [address, where] = parts
    const place = findPlaceInText(where)
    if (!place) return null
    return { address, city: place.name === place.state ? place.state : place.name, state: place.state, deliveryInstructions: DEFAULT_NOTE }
  }
  // Single line: find the first known place and split around it.
  const place = findPlaceInText(trimmed)
  if (!place) return null
  const escaped = place.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const at = trimmed.search(new RegExp(`\\b${escaped}\\b`, 'i'))
  const address = at > 0 ? trimmed.slice(0, at).replace(/[\s,]+$/, '').trim() : ''
  if (!address || !/\d/.test(address) && address.split(/\s+/).length < 2) return null
  const after = trimmed.slice(at + place.name.length).replace(new RegExp(`^[\\s,]*${place.state}(?:\\s+state)?`, 'i'), '').replace(/^[\s,.-]+/, '').trim()
  return { address, city: place.name === place.state ? place.state : place.name, state: place.state, deliveryInstructions: after || DEFAULT_NOTE }
}

// "reorder" / "same as last time": puts the buyer's most recent order's items back in
// the cart (skipping anything no longer listed or out of stock) and shows the cart.
export async function reorderLastOrder(waId: string): Promise<void> {
  await connectToDatabase()
  const mapping: any = await WhatsAppBuyer.findOne({ waId }).lean()
  const order: any = mapping?.customerId ? await Order.findOne({ customerId: String(mapping.customerId) }).sort({ createdAt: -1 }).lean() : null
  if (!order) {
    await trySendText(waId, "You haven't ordered with me before, so there's nothing to repeat yet. Tell me what you'd like and I'll find it.")
    return
  }
  const vendors: any[] = Array.isArray(order.vendors) ? order.vendors : []
  const lines: any[] = (Array.isArray(order.items) && order.items.length ? order.items : vendors.flatMap((v) => v?.items || []))
    .filter((item: any) => mongoose.isValidObjectId(String(item?.productId || '')))
  if (lines.length === 0) {
    await trySendText(waId, "I couldn't read the items on your last order. Tell me what you'd like and I'll find it.")
    return
  }
  const products: any[] = await Product.find({ _id: { $in: lines.map((l: any) => l.productId) } }).lean()
  const byId = new Map(products.map((p) => [String(p._id), p]))
  const added: string[] = []
  const skipped: string[] = []
  let state = await loadState(waId)
  for (const line of lines) {
    const product = byId.get(String(line.productId))
    const quantity = Math.max(1, Number(line.quantity || 1))
    const stock = Number(product?.stock)
    if (!product || product.status !== 'active' || (stock !== 9999 && Number.isFinite(stock) && stock < quantity)) {
      skipped.push(String(line.title || product?.name || 'an item'))
      continue
    }
    const selected = Array.isArray(line.selectedVariants) ? line.selectedVariants : []
    const result = await addProductToCart(waId, { ...product, id: String(product._id) }, quantity, selected, state)
    state = { ...state, cart: result.cart }
    added.push(`${result.addedTitle} x${quantity}`)
  }
  if (added.length === 0) {
    await trySendText(waId, `None of the items from your last order are available right now (${skipped.join(', ')}). Tell me what you'd like instead.`)
    return
  }
  await trySendText(waId, `Added from your last order: ${added.join(', ')}${skipped.length ? `. Not available now: ${skipped.join(', ')}` : ''}.\n\nType "checkout" when you're ready, or "cart" to review.`)
}

async function handleAddressReply(waId: string, text: string): Promise<void> {
  const parsed = parseAddressReply(text)
  if (!parsed) {
    await trySendText(
      waId,
      `I couldn't read that — please send it as 4 lines:\n\n${ADDRESS_PROMPT.split('\n\n')[1]}\n\n${ADDRESS_PROMPT.split('\n\n')[2]}`
    )
    return
  }

  await saveState(waId, { stage: 'quoting_delivery', pendingShippingInfo: parsed })
  await trySendText(waId, 'One moment, checking delivery options for your address...')
  await fetchAndPresentQuotes(waId, parsed)
}

async function fetchAndPresentQuotes(
  waId: string,
  shippingInfo: { address: string; city: string; state: string; deliveryInstructions: string }
): Promise<void> {
  const state = await loadState(waId)
  const cart: any[] = Array.isArray(state?.cart) ? state.cart : []

  if (cart.length === 0) {
    await trySendText(waId, 'Your cart is empty — nothing to check out.')
    await saveState(waId, { stage: 'browsing' })
    return
  }

  const { customerId } = await findOrCreateBuyerForWaId(waId)
  const buyer: any = await User.findById(customerId).lean()
  const buyerName = String(buyer?.name || '').trim() || 'Buyer'

  const quoteResult = await getDeliveryQuotesForCart({
    customerAddress: {
      name: buyerName,
      email: placeholderEmailForWaId(waId),
      phone: waId,
      address: shippingInfo.address,
      city: shippingInfo.city,
      state: shippingInfo.state,
    },
    items: cart.map((item) => ({ vendorId: item.vendorId, productId: item.productId, quantity: item.quantity, price: item.price })),
  })

  if (!quoteResult.success) {
    // Geocode failure (or any other whole-cart failure) — do NOT proceed with a failed
    // quote. Re-collect the address rather than guess.
    await trySendText(waId, `${quoteResult.error} Please resend your delivery address.`)
    await beginAddressCollection(waId)
    return
  }

  const failedVendors = quoteResult.vendors.filter((v) => v.error || v.couriers.length === 0)
  const okVendors = quoteResult.vendors.filter((v) => !v.error && v.couriers.length > 0)

  if (okVendors.length === 0) {
    await trySendText(
      waId,
      `Sorry, delivery isn't available right now for ${failedVendors.length > 1 ? 'any seller' : 'the seller'} in your cart (${failedVendors.map((v) => v.storeName).join(', ')}). Reply "cancel" to clear your cart, or resend your address to try again.`
    )
    await saveState(waId, { stage: 'awaiting_address' })
    return
  }

  // Partial-cart continuation: drop the vendor(s) that can't deliver, keep going with
  // the rest. A multi-vendor cart must not dead-end because one seller has an
  // unvalidated address or no mapped shipping category.
  let cart2 = cart
  const noticeLines: string[] = []
  if (failedVendors.length > 0) {
    const droppedNames = failedVendors.map((v) => v.storeName)
    cart2 = cart.filter((item) => !failedVendors.some((v) => v.productIds?.includes(item.productId) ?? v.vendorId === item.vendorId))
    noticeLines.push(
      `Heads up: ${droppedNames.join(', ')} can't deliver to you right now, so ${droppedNames.length > 1 ? 'those items were' : 'that item was'} removed from your cart. Continuing with the rest.`
    )
  }

  const selectedCouriers: Record<string, any> = {}
  const deliveryQuotesByVendor: Record<string, any> = {}
  for (const v of okVendors) {
    deliveryQuotesByVendor[v.groupId || v.vendorId] = v
    const cheapest = v.cheapestCourier
    if (cheapest) {
      selectedCouriers[v.groupId || v.vendorId] = {
        provider: cheapest.provider,
        quoteRef: cheapest.quoteRef,
        total: Number(cheapest.total || 0),
        courierName: cheapest.serviceLabel,
        deliveryEta: String(cheapest.etaLabel || ''),
      }
    }
  }

  await saveState(waId, {
    stage: 'choosing_couriers',
    cart: cart2,
    deliveryQuotes: deliveryQuotesByVendor,
    selectedCouriers,
  })

  const lines: string[] = [...noticeLines, 'Delivery options (cheapest pre-selected):']
  okVendors.forEach((v, vIndex) => {
    lines.push(`\n${vIndex + 1}. ${v.storeName}:`)
    const topCouriers = [...v.couriers].sort((a, b) => Number(a.total || 0) - Number(b.total || 0)).slice(0, 4)
    topCouriers.forEach((c, cIndex) => {
      const isDefault = selectedCouriers[v.groupId || v.vendorId]?.quoteRef === c.quoteRef
      lines.push(`  ${cIndex + 1}. ${c.serviceLabel} — ${formatNaira(Number(c.total || 0))}${c.etaLabel ? ` (${c.etaLabel})` : ''}${isDefault ? ' [default]' : ''}`)
    })
  })
  lines.push('\nReply "yes" to go with the defaults, or "change <seller #> <option #>" to pick a different courier (e.g. "change 1 2").')

  await trySendText(waId, lines.join('\n'))
}

async function presentTotalAndConfirm(waId: string): Promise<void> {
  const state = await loadState(waId)
  const cart: any[] = Array.isArray(state?.cart) ? state.cart : []
  const selectedCouriers: Record<string, any> = state?.selectedCouriers || {}

  const subtotal = cartSubtotal(cart)
  // Same formula as buildOrder (lib/order-creation.ts) — display only. buildOrder
  // independently recomputes the authoritative amount at order-creation time.
  const vat = Math.round(subtotal * 0.07)
  const shipping = Object.values(selectedCouriers).reduce((sum: number, c: any) => sum + Number(c?.total || 0), 0)
  const total = subtotal + vat + shipping

  await saveState(waId, { stage: 'confirming_total' })

  const lines = [
    'Order summary:',
    ...cart.map((item) => `- ${item.title}${Array.isArray(item.selectedVariants) && item.selectedVariants.length ? ` (${item.selectedVariants.map((variant: any) => `${variant.label}: ${variant.value}`).join(', ')})` : ''} x${item.quantity} — ${formatNaira(Number(item.price || 0) * Number(item.quantity || 1))}`),
    '',
    `Subtotal: ${formatNaira(subtotal)}`,
    `VAT (7%): ${formatNaira(vat)}`,
    `Delivery: ${formatNaira(shipping)}`,
    `Total: ${formatNaira(total)}`,
    '',
    'Reply "confirm" to place this order and get a payment link, or "cancel" to cancel.',
  ]

  await trySendText(waId, lines.join('\n'))
}

async function handleCourierReply(waId: string, text: string, state: any): Promise<void> {
  const trimmed = String(text || '').trim()
  const lower = trimmed.toLowerCase()

  if (lower === 'yes' || lower === 'confirm' || lower === 'ok' || lower === 'okay') {
    await presentTotalAndConfirm(waId)
    return
  }

  const changeMatch = trimmed.match(/^change\s+(\d+)\s+(\d+)$/i)
  if (changeMatch) {
    const deliveryQuotes: Record<string, any> = state?.deliveryQuotes || {}
    const vendorIdsOrdered = Object.keys(deliveryQuotes)
    const vendorIndex = Number(changeMatch[1]) - 1
    const courierIndex = Number(changeMatch[2]) - 1
    const vendorId = vendorIdsOrdered[vendorIndex]
    const quote = vendorId ? deliveryQuotes[vendorId] : null

    if (!vendorId || !quote) {
      await trySendText(waId, `I couldn't find seller #${changeMatch[1]}. Please check the number and try again.`)
      return
    }

    const topCouriers = [...(quote.couriers || [])].sort((a: any, b: any) => Number(a.total || 0) - Number(b.total || 0)).slice(0, 4)
    const chosen = topCouriers[courierIndex]
    if (!chosen) {
      await trySendText(waId, `I couldn't find option #${changeMatch[2]} for ${quote.storeName}. Please check the number and try again.`)
      return
    }

    const selectedCouriers = { ...(state?.selectedCouriers || {}) }
    selectedCouriers[vendorId] = {
      provider: chosen.provider,
      quoteRef: chosen.quoteRef,
      total: Number(chosen.total || 0),
      courierName: chosen.serviceLabel,
      deliveryEta: String(chosen.etaLabel || ''),
    }

    await saveState(waId, { selectedCouriers })
    await trySendText(waId, `Updated ${quote.storeName} to ${chosen.serviceLabel} — ${formatNaira(Number(chosen.total || 0))}. Reply "yes" when you're ready, or make another change.`)
    return
  }

  await trySendText(waId, 'Reply "yes" to go with the current selections, or "change <seller #> <option #>" to pick a different courier (e.g. "change 1 2").')
}

// Silently saves a freshly-typed address after a successful order, so it shows up in the
// picker next time — deliberately no extra "save this?" round-trip before payment (that
// friction outweighs the benefit in a chat flow); dedup means re-ordering to the same
// place repeatedly doesn't pile up copies. Returns the label used, or null if it was a
// duplicate of an already-saved address (nothing written).
async function maybeAutoSaveAddress(
  customerId: string,
  shippingInfo: { address: string; city: string; state: string; deliveryInstructions: string }
): Promise<string | null> {
  await connectToDatabase()
  const doc: any = await SavedAddress.findOne({ userId: customerId }).lean()
  const addresses: any[] = doc?.addresses || []

  const isDuplicate = addresses.some((a: any) =>
    String(a.address).trim().toLowerCase() === shippingInfo.address.trim().toLowerCase() &&
    String(a.city).trim().toLowerCase() === shippingInfo.city.trim().toLowerCase() &&
    String(a.state).trim().toLowerCase() === shippingInfo.state.trim().toLowerCase()
  )
  if (isDuplicate) return null

  const label = `WhatsApp Address ${addresses.length + 1}`
  const makeDefault = addresses.length === 0

  if (makeDefault) {
    await SavedAddress.updateOne({ userId: customerId }, { $set: { 'addresses.$[].isDefault': false } })
  }

  await SavedAddress.updateOne(
    { userId: customerId },
    {
      $push: {
        addresses: {
          label,
          address: shippingInfo.address,
          city: shippingInfo.city,
          state: shippingInfo.state,
          deliveryInstructions: shippingInfo.deliveryInstructions || '',
          isDefault: makeDefault,
          createdAt: new Date(),
        },
      },
    },
    { upsert: true }
  )

  return label
}

async function handleConfirmReply(waId: string, text: string): Promise<void> {
  const lower = String(text || '').trim().toLowerCase()
  if (lower !== 'confirm' && lower !== 'yes') {
    await trySendText(waId, 'Reply "confirm" to place this order and get a payment link, or "cancel" to cancel.')
    return
  }

  const state = await loadState(waId)
  const cart: any[] = Array.isArray(state?.cart) ? state.cart : []
  const selectedCouriers: Record<string, any> = state?.selectedCouriers || {}
  const pendingShippingInfo = state?.pendingShippingInfo || {}

  if (cart.length === 0) {
    await trySendText(waId, 'Your cart is empty — nothing to confirm.')
    await saveState(waId, { stage: 'browsing' })
    return
  }

  const { customerId } = await findOrCreateBuyerForWaId(waId)
  const buyer: any = await User.findById(customerId).lean()
  const nameParts = String(buyer?.name || 'Buyer').trim().split(/\s+/)
  const firstName = nameParts[0] || 'Buyer'
  const lastName = nameParts.slice(1).join(' ') || 'Buyer'

  const items = cart.map((item) => ({
    productId: item.productId,
    title: item.title,
    quantity: item.quantity,
    price: item.price,
    vendorId: item.vendorId,
    vendorName: item.vendorName,
    selectedVariants: item.selectedVariants || [],
  }))

  const shippingInfo = {
    firstName,
    lastName,
    address: pendingShippingInfo.address,
    city: pendingShippingInfo.city,
    state: pendingShippingInfo.state,
    country: 'Nigeria',
    deliveryInstructions: pendingShippingInfo.deliveryInstructions,
  }

  const result = await initiateWaBuyerPaystackCheckout({
    waId,
    name: buyer?.name,
    items,
    shippingInfo,
    courierSelections: selectedCouriers,
  })

  if (!result.success) {
    await trySendText(waId, `Sorry, I couldn't place that order: ${result.error}. Reply "cancel" to start over, or try "confirm" again.`)
    return
  }

  await saveState(waId, { stage: 'awaiting_payment', pendingOrderId: result.orderId, pendingPaymentUrl: result.authorizationUrl, pendingPaymentTotal: result.totalAmount })

  // Only auto-save when this address was freshly typed, not when it was already picked
  // from the saved list (pendingShippingInfoFromSavedId set) — no point re-saving it.
  let savedLabel: string | null = null
  if (!state?.pendingShippingInfoFromSavedId) {
    savedLabel = await maybeAutoSaveAddress(customerId, pendingShippingInfo).catch(() => null)
  }

  await trySendText(
    waId,
    `Almost there! Tap the link below to pay ${formatNaira(result.totalAmount)} securely:\n\n${result.authorizationUrl}\n\nOnce payment is confirmed we'll message you here.`
    + (savedLabel ? `\n\n(Saved this address as "${savedLabel}" for next time.)` : '')
  )
}

// 'paid' | 'unpaid' | 'gone' for the order a buyer is waiting to pay.
async function pendingOrderStatus(orderId: string): Promise<'paid' | 'unpaid' | 'gone'> {
  await connectToDatabase()
  const order: any = await Order.findOne({ orderId }).select('paymentStatus status').lean()
  if (!order) return 'gone'
  const paid = ['paid', 'escrow', 'released'].includes(String(order.paymentStatus || '').toLowerCase())
  return paid ? 'paid' : 'unpaid'
}

// Messages while an order awaits payment: "send the link again", "I've paid", or a
// question. Returns false when the message is something else (a new search, etc.) so
// the normal router handles it — the buyer isn't held hostage by an unpaid order.
export async function tryHandleAwaitingPayment(waId: string, text: string, state: any): Promise<boolean> {
  const orderId = String(state?.pendingOrderId || '')
  if (!orderId) return false
  const ref = orderId.slice(0, 8).toUpperCase()
  const status = await pendingOrderStatus(orderId)

  if (status === 'paid') {
    // Payment landed but the confirmation hook didn't clear the state (or the buyer
    // asked before it ran) — clear it now.
    await saveState(waId, { stage: 'browsing', cart: [], pendingShippingInfo: {}, deliveryQuotes: {}, selectedCouriers: {}, pendingOrderId: null, pendingPaymentUrl: null, pendingPaymentTotal: null })
    if (/\b(paid|payment|transfer|sent the money|done|link|pay)\b/i.test(text)) {
      await trySendText(waId, `Payment received — order ${ref} is confirmed! We'll message you here as it ships. Type "my orders" any time to check.`)
      return true
    }
    return false
  }
  if (status === 'gone') {
    await saveState(waId, { stage: 'browsing', pendingOrderId: null, pendingPaymentUrl: null, pendingPaymentTotal: null })
    return false
  }

  const trimmed = String(text || '').trim()
  if (/\b(link|resend|send (?:it|the link) again|pay(?: now)?|how (?:do|can) i pay|payment link|where (?:do|can) i pay)\b/i.test(trimmed)) {
    await trySendText(
      waId,
      `Here's the payment link for order ${ref}${state.pendingPaymentTotal ? ` (${formatNaira(Number(state.pendingPaymentTotal))})` : ''}:\n\n${state.pendingPaymentUrl || 'Sorry, I no longer have the link — reply "cancel" and check out again.'}\n\nCard, bank transfer or USSD all work. I'll confirm here the moment it goes through.`
    )
    return true
  }
  if (/\b(i(?:'ve| have)? (?:already )?paid|payment (?:made|done|sent|successful)|i (?:have )?(?:made|sent|completed) (?:the )?(?:payment|transfer)|done paying|paid already|transferred|i don paid?|i don pay)\b/i.test(trimmed)) {
    await trySendText(
      waId,
      `I can't see the payment for order ${ref} yet — it usually shows within a minute of Paystack confirming. I'll message you here as soon as it lands. If it's been a while, check that the payment went through on your bank/card app; reply "link" to try again, or "cancel" to drop the order.`
    )
    return true
  }
  return false
}

// Dispatcher for the four "blocking" stages — lib/whatsapp/buyer.ts routes here directly
// once it sees the buyer's stage isn't 'browsing'/'cart'.
// Questions people ask while we're waiting for their name/address ("how much is
// delivery?", "can I pay on delivery?") get answered, then the prompt is repeated.
const MID_CHECKOUT_FAQ_TOPICS = new Set(['delivery', 'payment', 'returns', 'support', 'how-to-order'])
const STAGE_REPROMPT: Record<string, string> = {
  awaiting_name: 'When you\'re ready, just send your name to continue.',
  awaiting_address: 'When you\'re ready, send your delivery address (street, city, state).',
  choosing_couriers: 'Reply "yes" to go with the current delivery options, or "change <seller #> <option #>".',
  confirming_total: 'Reply "confirm" to place the order, or "cancel".',
}

export async function handleCheckoutStageMessage(waId: string, text: string, stage: string): Promise<void> {
  const state = await loadState(waId)

  if (STAGE_REPROMPT[stage]) {
    const faq = answerBuyerFaq(text, { hasRecentResults: true })
    if (faq?.kind === 'text' && MID_CHECKOUT_FAQ_TOPICS.has(faq.topic)) {
      await trySendText(waId, `${faq.body.replace(/\s*Tell me what you'd like to buy to get started\.$/, '')}\n\n${STAGE_REPROMPT[stage]}`)
      return
    }
  }

  switch (stage) {
    case 'awaiting_name':
      await handleNameReply(waId, text)
      return
    case 'choosing_saved_address':
      // Normally resolved via the list picker's tap (routed straight to
      // handleSavedAddressListReply by the webhook, never reaching here) — this only
      // fires if the buyer typed instead of tapping.
      if (String(text || '').trim().toLowerCase() === 'new') {
        await beginAddressCollection(waId)
        return
      }
      await trySendText(waId, 'Please tap one of the address options above, or reply "new" to enter a different address.')
      return
    case 'awaiting_address':
      await handleAddressReply(waId, text)
      return
    case 'quoting_delivery':
      // A message landed here only if something was interrupted mid-fetch (e.g. a
      // server restart) — safest recovery is to re-collect the address rather than
      // trust a possibly-incomplete quote.
      await beginAddressCollection(waId)
      return
    case 'choosing_couriers':
      await handleCourierReply(waId, text, state)
      return
    case 'confirming_total':
      await handleConfirmReply(waId, text)
      return
    case 'awaiting_payment':
      await trySendText(waId, 'Your order is awaiting payment — tap the payment link we sent earlier. If you\'d like to start a new order, reply "cancel" first.')
      return
    default:
      return
  }
}

// ---------------------------------------------------------------------------
// Payment confirmation hook
// ---------------------------------------------------------------------------

// Called from lib/order-payment-confirmation.ts's handleOrderPaid, once an order is
// successfully claimed (i.e. exactly once per order, thanks to that function's own
// idempotency guard) — clears the buyer's checkout state back to browsing and sends a
// best-effort confirmation. Immediately no-ops for a non-WhatsApp (website) customerId.
// Wrapped in after(), same pattern as notifyVendorsNewOrder: never adds latency to the
// payment-confirmation response, and can't block the courier-dispatch/vendor-notify/
// stock steps that run before it in handleOrderPaid.
export function notifyWaBuyerOrderPaid(customerId: string, orderId: string): void {
  after(async () => {
    try {
      await connectToDatabase()
      const mapping: any = await WhatsAppBuyer.findOne({ customerId }).lean()
      if (!mapping?.waId) return // not a WhatsApp buyer — nothing to do

      const waId = String(mapping.waId)

      // Clear checkout state regardless of whether the confirmation send below
      // succeeds — the order is paid either way, and a buyer left stuck in
      // 'awaiting_payment' after having already paid would otherwise be unable to
      // start a new checkout.
      await saveState(waId, {
        stage: 'browsing',
        cart: [],
        pendingShippingInfo: {},
        deliveryQuotes: {},
        selectedCouriers: {},
        pendingOrderId: null,
      })

      const ref = String(orderId || '').slice(0, 8).toUpperCase()
      // Prefers the approved buyer_order_paid_confirmation template (delivers regardless
      // of Meta's 24h customer-service window) — falls back to free text if that send
      // fails for any reason (not yet approved, since rejected/renamed, etc.), so this
      // never regresses below the prior free-text-only behavior and self-heals the
      // moment Meta approves it.
      try {
        await sendTemplateMessage(waId, 'buyer_order_paid_confirmation', [ref])
      } catch (templateError) {
        console.log(`[whatsapp-checkout] buyer_order_paid_confirmation template send failed, falling back to free text — order ${orderId}:`, templateError)
        await trySendText(waId, `Your order ${ref} is confirmed and paid! We'll let you know as it ships.`)
      }
    } catch (error) {
      console.error(`[whatsapp-checkout] Order-paid notify failed for order ${orderId}:`, error)
    }
  })
}
