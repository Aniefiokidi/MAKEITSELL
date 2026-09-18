// Messages the bot sends without being asked: "how was it?" after a delivery, and "it's
// back in stock" for something a buyer wanted. Both go template-first (Meta requires an
// approved template outside the 24h window — see docs/whatsapp-templates.md) with a
// free-text fallback, via sendWaNotification. Run daily from
// app/api/admin/whatsapp/proactive.
import mongoose from 'mongoose'
import connectToDatabase from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { Product } from '@/lib/models/Product'
import { Review } from '@/lib/models/Review'
import { WhatsAppBuyer } from '@/lib/models/WhatsAppBuyer'
import { WhatsAppBrowseState } from '@/lib/models/WhatsAppBrowseState'
import { WhatsAppStockWatch } from '@/lib/models/WhatsAppStockWatch'
import { sendWaNotification } from '@/lib/whatsapp/notify'

const REVIEW_AFTER_HOURS = 48
const REVIEW_WINDOW_DAYS = 7

function firstItem(order: any): any {
  const items: any[] = Array.isArray(order?.items) && order.items.length ? order.items : (order?.vendors || []).flatMap((v: any) => v?.items || [])
  return items.find((i) => i?.productId && (i?.title || i?.name)) || null
}

// Orders received 2–7 days ago by WhatsApp buyers, not yet asked, not yet reviewed.
export async function sendReviewPrompts(): Promise<{ sent: number }> {
  await connectToDatabase()
  const now = Date.now()
  const orders: any[] = await Order.find({
    status: 'received',
    receivedAt: { $gte: new Date(now - REVIEW_WINDOW_DAYS * 86400000), $lte: new Date(now - REVIEW_AFTER_HOURS * 3600000) },
    reviewPromptSentAt: { $exists: false },
  }).limit(200).lean()
  let sent = 0
  for (const order of orders) {
    const mapping: any = await WhatsAppBuyer.findOne({ customerId: String(order.customerId) }).lean()
    if (!mapping?.waId) {
      await Order.updateOne({ _id: order._id }, { $set: { reviewPromptSentAt: new Date(), reviewPromptSkipped: 'not_whatsapp' } })
      continue
    }
    const item = firstItem(order)
    if (!item) continue
    const reviewed = await Review.exists({ orderId: order.orderId, customerId: String(order.customerId) })
    if (reviewed) {
      await Order.updateOne({ _id: order._id }, { $set: { reviewPromptSentAt: new Date(), reviewPromptSkipped: 'already_reviewed' } })
      continue
    }
    const name = String(item.title || item.name)
    await WhatsAppBrowseState.findOneAndUpdate(
      { waId: mapping.waId },
      { $set: { pendingReview: { orderId: order.orderId, productId: String(item.productId), productName: name, vendorId: String(item.vendorId || order.vendors?.[0]?.vendorId || ''), storeId: String(item.storeId || order.vendors?.[0]?.storeId || ''), askedAt: new Date() }, updatedAt: new Date() } },
      { upsert: true }
    )
    await sendWaNotification({
      waId: mapping.waId,
      template: { name: 'buyer_review_prompt', params: [name] },
      freeTextBody: `How was your ${name}? Reply with a number from 1 to 5 (5 = loved it). Your rating helps other buyers and the seller.`,
    })
    await Order.updateOne({ _id: order._id }, { $set: { reviewPromptSentAt: new Date() } })
    sent++
  }
  return { sent }
}

// A rating reply ("4", "5 stars", "⭐⭐⭐⭐") while a review is pending; then an optional
// comment. Returns false when there's no pending review or the text isn't a rating.
export async function tryHandleReviewReply(waId: string, text: string, state: any): Promise<boolean> {
  const pending = state?.pendingReview
  if (!pending?.orderId) return false
  const askedAt = pending.askedAt ? new Date(pending.askedAt).getTime() : 0
  if (Date.now() - askedAt > REVIEW_WINDOW_DAYS * 86400000) return false
  const trimmed = String(text || '').trim()

  if (pending.rating) {
    // Waiting for the optional comment.
    const skip = /^(?:skip|no|nope|nothing|none|n\/a|no comment|ok|done)[\s!.]*$/i.test(trimmed)
    const comment = skip ? '' : trimmed.slice(0, 500)
    await saveReview(waId, pending, comment)
    return true
  }

  const stars = (trimmed.match(/⭐|★/g) || []).length
  const numeric = trimmed.match(/^(?:(\d)(?:\s*(?:\/\s*5|stars?|star|out of 5))?)[\s!.]*$/i)
  const rating = stars >= 1 && stars <= 5 ? stars : numeric ? Number(numeric[1]) : 0
  if (!rating || rating < 1 || rating > 5) {
    // Not a rating — let them off the hook and handle the message normally.
    if (/^(?:skip|no thanks|not now|later|no)[\s!.]*$/i.test(trimmed)) {
      await WhatsAppBrowseState.updateOne({ waId }, { $unset: { pendingReview: '' } })
      await sendWaNotification({ waId, freeTextBody: 'No problem — thanks anyway!' })
      return true
    }
    return false
  }
  await WhatsAppBrowseState.updateOne({ waId }, { $set: { 'pendingReview.rating': rating } })
  await sendWaNotification({
    waId,
    freeTextBody: `${rating >= 4 ? 'Great to hear!' : rating === 3 ? 'Thanks — noted.' : "Sorry it wasn't better."} Anything you'd like to add for the seller or other buyers? Reply with a comment, or "skip".${rating <= 2 ? ' If something was wrong with the item, reply "problem with my order" and we\'ll sort it out.' : ''}`,
  })
  return true
}

async function saveReview(waId: string, pending: any, comment: string): Promise<void> {
  await connectToDatabase()
  const mapping: any = await WhatsAppBuyer.findOne({ waId }).lean()
  const order: any = await Order.findOne({ orderId: pending.orderId }).lean()
  if (mapping?.customerId && order) {
    const already = await Review.exists({ orderId: pending.orderId, customerId: String(mapping.customerId) })
    if (!already) {
      const product: any = pending.productId && mongoose.isValidObjectId(pending.productId) ? await Product.findById(pending.productId).select('vendorId storeId').lean() : null
      await Review.create({
        storeId: String(pending.storeId || product?.storeId || order.vendors?.[0]?.storeId || ''),
        vendorId: String(pending.vendorId || product?.vendorId || order.vendors?.[0]?.vendorId || ''),
        productId: String(pending.productId || ''),
        customerId: String(mapping.customerId),
        customerName: String(order.shippingInfo?.firstName || 'WhatsApp buyer'),
        orderId: pending.orderId,
        rating: Number(pending.rating),
        comment,
      })
    }
  }
  await WhatsAppBrowseState.updateOne({ waId }, { $unset: { pendingReview: '' } })
  await sendWaNotification({ waId, freeTextBody: `Thanks — your ${pending.rating}-star review for ${pending.productName} is posted. 🙏` })
}

// Remember that this buyer wanted a product that's out of stock.
export async function watchStock(waId: string, product: any): Promise<void> {
  try {
    await connectToDatabase()
    await WhatsAppStockWatch.updateOne(
      { waId, productId: String(product?._id || product?.id || '') },
      { $setOnInsert: { productName: String(product?.name || ''), createdAt: new Date() } },
      { upsert: true }
    )
  } catch { /* best effort */ }
}

export async function sendBackInStockAlerts(): Promise<{ sent: number }> {
  await connectToDatabase()
  const watches: any[] = await WhatsAppStockWatch.find({}).limit(500).lean()
  if (watches.length === 0) return { sent: 0 }
  const products: any[] = await Product.find({ _id: { $in: Array.from(new Set(watches.map((w) => w.productId))) }, status: 'active', stock: { $gt: 0 } }).lean()
  const byId = new Map(products.map((p) => [String(p._id), p]))
  let sent = 0
  const optedOut = new Set((await WhatsAppBuyer.find({ waId: { $in: watches.map((w) => w.waId) }, marketingOptOut: true }).select('waId').lean()).map((b: any) => String(b.waId)))
  for (const watch of watches) {
    if (optedOut.has(String(watch.waId))) { await WhatsAppStockWatch.deleteOne({ _id: watch._id }); continue }
    const product = byId.get(String(watch.productId))
    if (!product) continue
    const price = `NGN ${Number(product.price || 0).toLocaleString('en-NG')}`
    await WhatsAppBrowseState.findOneAndUpdate(
      { waId: watch.waId },
      { $set: { lastResults: [{ id: String(product._id), kind: 'product', messageId: '', name: String(product.name), price: Number(product.price || 0) }], lastResultsAt: new Date(), updatedAt: new Date() } },
      { upsert: true }
    )
    await sendWaNotification({
      waId: watch.waId,
      template: { name: 'buyer_back_in_stock', params: [String(product.name), price] },
      freeTextBody: `Good news — ${product.name} is back in stock at ${price}. Reply "add" to put it in your cart, or "details" to hear more.`,
    })
    await WhatsAppStockWatch.deleteOne({ _id: watch._id })
    sent++
  }
  return { sent }
}
