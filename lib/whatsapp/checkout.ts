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
import { after } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { Product } from '@/lib/models/Product'
import { User } from '@/lib/models/User'
import { getProducts } from '@/lib/mongodb-operations'
import { WhatsAppBrowseState } from '@/lib/models/WhatsAppBrowseState'
import { WhatsAppProductMessageMap } from '@/lib/models/WhatsAppProductMessageMap'
import { WhatsAppBuyer } from '@/lib/models/WhatsAppBuyer'
import { SavedAddress } from '@/lib/models/SavedAddress'
import { sendTextMessage, sendInteractiveListMessage, type WhatsAppListRow } from '@/lib/whatsapp/client'
import { findOrCreateBuyerForWaId, setBuyerName, placeholderEmailForWaId, PLACEHOLDER_BUYER_NAME } from '@/lib/whatsapp/buyer-identity'
import { initiateWaBuyerPaystackCheckout } from '@/lib/whatsapp/buyer-orders'
import { getDeliveryQuotesForCart } from '@/lib/delivery-quotes'

// Stages that own the buyer's very next message entirely — the normal browsing/search
// dispatch in lib/whatsapp/buyer.ts is bypassed while in one of these. 'cart' is
// deliberately NOT here: a buyer with items in cart can still search, browse categories,
// or add more, exactly like plain browsing.
export const BLOCKING_CHECKOUT_STAGES = new Set([
  'awaiting_name',
  'choosing_saved_address',
  'awaiting_address',
  'quoting_delivery',
  'choosing_couriers',
  'confirming_total',
  'awaiting_payment',
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

async function addProductToCart(waId: string, product: any, quantity: number): Promise<{ cart: any[]; addedTitle: string }> {
  const state = await loadState(waId)
  const cart: any[] = Array.isArray(state?.cart) ? [...state.cart] : []

  const productId = String(product?.id || product?._id || '')
  const existingIndex = cart.findIndex((item) => String(item.productId) === productId)

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
// Works regardless of what the reply TEXT says — replying to a specific product is a
// stronger signal of intent than parsing the words, matching how a real customer would
// tap "add to cart" on a specific listing. A bare positive integer in the reply is read
// as quantity; anything else defaults to 1.
export async function tryHandleProductReply(waId: string, contextMessageId: string, text: string): Promise<boolean> {
  await connectToDatabase()
  const mapping: any = await WhatsAppProductMessageMap.findOne({ messageId: contextMessageId }).lean()
  if (!mapping?.productId) return false

  const product: any = await Product.findOne({ _id: mapping.productId, status: 'active' }).lean()
  if (!product) {
    await trySendText(waId, "Sorry, that item isn't available anymore. Search again to see what's in stock.")
    return true
  }

  const trimmedReply = String(text || '').trim()
  const quantity = /^\d+$/.test(trimmedReply) && Number(trimmedReply) > 0 ? Number(trimmedReply) : 1

  const productWithId = { ...product, id: String(product._id) }
  const { cart, addedTitle } = await addProductToCart(waId, productWithId, quantity)

  await trySendText(
    waId,
    `Added: ${addedTitle} x${quantity}\n\nCart: ${cart.length} item(s), ${formatNaira(cartSubtotal(cart))}. Type "cart" to view, "checkout" when ready, or keep searching.`
  )
  return true
}

// Fuzzy backup: "sneakers, iphone case" — each comma-separated segment is matched
// against active products individually. An unambiguous single match adds directly; zero
// or multiple matches ask the buyer to search that term and reply-select instead, rather
// than guessing.
export async function tryHandleCommaSeparatedAdd(waId: string, text: string): Promise<boolean> {
  const segments = String(text || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (segments.length === 0) return false

  const results: string[] = []
  for (const segment of segments) {
    const matches = await getProducts({ search: segment, status: 'active', limitCount: 5 })
    if (matches.length === 0) {
      results.push(`"${segment}": no match found.`)
    } else if (matches.length === 1) {
      await addProductToCart(waId, matches[0], 1)
      results.push(`Added: ${matches[0].name}`)
    } else {
      results.push(`"${segment}": matched multiple products — search for it to see options and reply to add one.`)
    }
  }

  const state = await loadState(waId)
  const cart: any[] = Array.isArray(state?.cart) ? state.cart : []

  await trySendText(
    waId,
    `${results.join('\n')}\n\nCart: ${cart.length} item(s), ${formatNaira(cartSubtotal(cart))}. Type "cart" to view, "checkout" when ready, or keep searching.`
  )
  return true
}

export async function sendCartSummary(waId: string): Promise<void> {
  const state = await loadState(waId)
  const cart: any[] = Array.isArray(state?.cart) ? state.cart : []

  if (cart.length === 0) {
    await trySendText(waId, 'Your cart is empty. Search for a product and reply to a result to add it.')
    return
  }

  const lines = cart.map((item, i) => `${i + 1}. ${item.title} x${item.quantity} — ${formatNaira(Number(item.price || 0) * Number(item.quantity || 1))}`)

  await trySendText(
    waId,
    `Your cart:\n${lines.join('\n')}\n\nSubtotal: ${formatNaira(cartSubtotal(cart))}\n\nReply "checkout" to continue, "remove <#>" to remove an item, or keep searching to add more.`
  )
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

function parseAddressReply(text: string): { address: string; city: string; state: string; deliveryInstructions: string } | null {
  const trimmed = String(text || '').trim()
  if (!trimmed) return null

  let parts = trimmed.split('\n').map((p) => p.trim()).filter(Boolean)
  if (parts.length !== 4) {
    parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean)
  }
  if (parts.length !== 4) return null

  const [address, city, state, deliveryInstructions] = parts
  if (!address || !city || !state || !deliveryInstructions) return null
  return { address, city, state, deliveryInstructions }
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
    cart2 = cart.filter((item) => !failedVendors.some((v) => v.vendorId === item.vendorId))
    noticeLines.push(
      `Heads up: ${droppedNames.join(', ')} can't deliver to you right now, so ${droppedNames.length > 1 ? 'those items were' : 'that item was'} removed from your cart. Continuing with the rest.`
    )
  }

  const selectedCouriers: Record<string, any> = {}
  const deliveryQuotesByVendor: Record<string, any> = {}
  for (const v of okVendors) {
    deliveryQuotesByVendor[v.vendorId] = v
    const cheapest = v.cheapestCourier
    if (cheapest) {
      selectedCouriers[v.vendorId] = {
        courierId: cheapest.courier_id,
        serviceCode: cheapest.service_code,
        total: Number(cheapest.total || 0),
        courierName: cheapest.courier_name,
        deliveryEta: String(cheapest.delivery_eta || ''),
        requestToken: v.requestToken,
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
      const isDefault = selectedCouriers[v.vendorId]?.courierId === c.courier_id && selectedCouriers[v.vendorId]?.serviceCode === c.service_code
      lines.push(`  ${cIndex + 1}. ${c.courier_name} — ${formatNaira(Number(c.total || 0))}${c.delivery_eta ? ` (${c.delivery_eta})` : ''}${isDefault ? ' [default]' : ''}`)
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
    ...cart.map((item) => `- ${item.title} x${item.quantity} — ${formatNaira(Number(item.price || 0) * Number(item.quantity || 1))}`),
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
      courierId: chosen.courier_id,
      serviceCode: chosen.service_code,
      total: Number(chosen.total || 0),
      courierName: chosen.courier_name,
      deliveryEta: String(chosen.delivery_eta || ''),
      requestToken: quote.requestToken,
    }

    await saveState(waId, { selectedCouriers })
    await trySendText(waId, `Updated ${quote.storeName} to ${chosen.courier_name} — ${formatNaira(Number(chosen.total || 0))}. Reply "yes" when you're ready, or make another change.`)
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
    shipbubbleSelections: selectedCouriers,
  })

  if (!result.success) {
    await trySendText(waId, `Sorry, I couldn't place that order: ${result.error}. Reply "cancel" to start over, or try "confirm" again.`)
    return
  }

  await saveState(waId, { stage: 'awaiting_payment', pendingOrderId: result.orderId })

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

// Dispatcher for the four "blocking" stages — lib/whatsapp/buyer.ts routes here directly
// once it sees the buyer's stage isn't 'browsing'/'cart'.
export async function handleCheckoutStageMessage(waId: string, text: string, stage: string): Promise<void> {
  const state = await loadState(waId)

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
      // Best-effort — this is free text, not an approved template, so it only works
      // within Meta's 24h customer-service window. A buyer who just checked out via
      // chat is almost always still inside that window when payment confirms shortly
      // after. TODO: an approved order_confirmed template (like Phase 2's
      // order_received) would make this reliable outside the window too — not built
      // here, explicitly out of scope for this task.
      await trySendText(waId, `Your order ${ref} is confirmed and paid! We'll let you know as it ships.`)
    } catch (error) {
      console.error(`[whatsapp-checkout] Order-paid notify failed for order ${orderId}:`, error)
    }
  })
}
