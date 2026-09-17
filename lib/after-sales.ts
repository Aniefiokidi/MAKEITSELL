import mongoose from 'mongoose'
import { randomUUID } from 'crypto'
import { Order } from './models/Order'
import { Store } from './models/Store'
import { Product } from './models/Product'
import { User } from './models/User'
import { WalletTransaction } from './models/WalletTransaction'
import connectToDatabase from './mongodb'
import { activeCase, afterHours, canClear, cents, CLEARANCE_HOURS, evidenceUrls, initialLines, REASONS, refundCents } from './after-sales-policy'
import { fetchRefund, initiateRefund, REFUND_FAILED_STATUSES, REFUND_SETTLED_STATUSES } from './paystack-refund'

// A provider refund that has been requested but not yet confirmed by Paystack. If it
// sits unconfirmed this long the case escalates for a human — Paystack refunds normally
// settle in minutes, and a day-long silence is worth a look, not a retry.
const PROVIDER_REFUND_HOURS = 72
// If the process died between recording intent and hearing back from Paystack, we
// cannot know whether the request went out. After this grace period, escalate rather
// than risk a second request against the same charge.
const PROVIDER_INTENT_GRACE_MINUTES = 15

type Actor = { id: string; role: string; email?: string }
const text = (v: unknown, max = 2000) => String(v || '').trim().slice(0, max)
function requireValue(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message) }
function event(c: any, actor: string, message: string) { c.history.push({ at: new Date(), actor, message, status: c.status }) }

// Every payout, complaint and refund writes the same order inside a transaction.
// MongoDB retries conflicting operations; a complaint cannot race an item payout.
export async function mutateOrder(orderId: string, fn: (order: any, session: mongoose.ClientSession) => Promise<any>) {
  await connectToDatabase()
  const session = await mongoose.startSession()
  try {
    return await session.withTransaction(async () => {
      const order: any = await Order.findOne({ orderId }).session(session)
      requireValue(order, 'Order not found')
      if (!order.protectionLines?.length) order.protectionLines = initialLines(order)
      order.afterSalesCases ||= []
      if (order.disputeRaisedAt || order.disputeStatus === 'active') {
        for (const line of order.protectionLines) {
          if (line.cancelled || (line.refundedQuantity || 0) >= line.quantity || order.afterSalesCases.some((c: any) => c.lineId === line.id && activeCase(c))) continue
          const legacy: any = { id: `legacy:${orderId}:${line.id}`, lineId: line.id, vendorId: line.vendorId, storeId: line.storeId, title: line.title, quantity: line.quantity - (line.refundedQuantity || 0), amountCents: line.amountCents - (line.refundedCents || 0), kind: 'complaint', reason: order.customerDisputeReason || 'other', description: order.customerDisputeDescription || 'Earlier order dispute; review the original order evidence.', refundMethod: 'original', status: 'admin_review', legacy: true, createdAt: order.disputeRaisedAt || new Date(), deadline: afterHours(48), evidence: (order.customerDisputeEvidence || []).filter((url: any) => typeof url === 'string' && url.startsWith('https://')), history: [] }
          event(legacy, 'system', 'Earlier order dispute moved to item review. No funds were released or refunded.'); order.afterSalesCases.push(legacy)
        }
        order.disputeRaisedAt = undefined; order.disputeStatus = 'migrated'
      }
      order.protectionNotices ||= []
      for (const c of order.afterSalesCases) {
        if (!activeCase(c) || !c.deadline || new Date(c.deadline).getTime() > Date.now()) continue
        if (c.status === 'replacement_clearance') { c.status = 'resolved'; c.closedAt = new Date(); event(c, 'system', 'Replacement clearance completed without another complaint') }
        else if (c.status !== 'admin_review') { c.resumeStatus = c.status; c.status = 'admin_review'; event(c, 'system', 'Deadline missed; admin review required') }
      }
      const result = await fn(order, session)
      for (const c of order.afterSalesCases) {
        const reference = `case:${c.id}:${c.history.length}`
        if (!order.protectionNotices.some((n: any) => n.reference === reference)) order.protectionNotices.push({ reference, userIds: [String(order.customerId), c.vendorId], message: `Request for ${c.title}: ${c.status.replace(/_/g, ' ')}. Open the case timeline for the next step and deadline.`, createdAt: new Date() })
      }
      order.markModified('protectionNotices')
      order.markModified('protectionLines'); order.markModified('afterSalesCases')
      await order.save({ session })
      return result
    })
  } finally { await session.endSession() }
}

export async function openCase(actor: Actor, input: any) {
  return mutateOrder(text(input.orderId, 100), async order => {
    requireValue(String(order.customerId) === actor.id, 'You can only report your own purchase')
    requireValue(['escrow', 'released', 'completed'].includes(order.paymentStatus), 'This payment is not eligible; contact support for reconciled or refunded payments')
    const line = order.protectionLines.find((l: any) => l.id === input.lineId)
    requireValue(line && !line.cancelled, 'Item not found or cancelled')
    requireValue(!order.afterSalesCases.some((c: any) => c.lineId === line.id && activeCase(c)), 'An active case already exists for this item')
    requireValue(input.reason !== 'service_issue', 'Use the service booking issue form')
    requireValue(REASONS.includes(input.reason), 'Choose a valid reason')
    requireValue(['return', 'replacement', 'complaint'].includes(input.kind), 'Choose a resolution')
    requireValue(text(input.description).length >= 10, 'Please describe the issue in at least 10 characters')
    const amountCents = refundCents(line, Number(input.quantity))
    const c: any = {
      id: randomUUID(), lineId: line.id, vendorId: line.vendorId, storeId: line.storeId,
      title: line.title, quantity: Number(input.quantity), amountCents, kind: input.kind,
      reason: input.reason, description: text(input.description), receivedVariant: text(input.receivedVariant, 300),
      desiredVariant: text(input.desiredVariant, 300), evidence: evidenceUrls(input.evidence || []),
      refundMethod: input.refundMethod === 'wallet' ? 'wallet' : 'original',
      pickupAddress: text(input.pickupAddress, 500), status: line.settledAt ? 'admin_review' : 'requested',
      requiresPolicyException: ['change_of_mind', 'size_change'].includes(input.reason) && !!line.availableAt && new Date(line.availableAt).getTime() < Date.now(),
      lateClaim: !!line.settledAt, createdAt: new Date(), deadline: afterHours(48), history: [],
    }
    event(c, actor.id, c.lateClaim ? 'Late claim submitted for funding and eligibility review' : 'Request submitted; affected item payout held')
    order.afterSalesCases.push(c)
    return c
  })
}

async function walletUser(line: any, session: mongoose.ClientSession) {
  const store: any = mongoose.isValidObjectId(line.storeId) ? await Store.findById(line.storeId).session(session).lean() : null
  requireValue(!store || String(store.vendorId) === line.vendorId, 'Store ownership requires review')
  return String(store?.linkedWalletUserId || line.vendorId)
}

export async function settleOrder(orderId: string) {
  const result = await mutateOrder(orderId, async (order, session) => {
    if (order.paymentStatus !== 'escrow' || order.disputeRaisedAt || order.disputeStatus === 'active') return { success: false, reason: 'payment_or_dispute_hold' }
    let totalCredited = 0
    const creditedWalletUserIds: string[] = []
    for (const line of order.protectionLines) {
      if (!canClear(line, order.afterSalesCases)) continue
      const amount = (line.amountCents - (line.refundedCents || 0)) / 100
      if (amount > 0) {
        const userId = await walletUser(line, session)
        const updated = await User.updateOne({ _id: userId }, { $inc: { walletBalance: amount, earnedBalance: amount } }, { session })
        requireValue(updated.matchedCount, 'Vendor wallet missing; payout remains held')
        await WalletTransaction.create([{ userId, type: 'vendor_credit', amount, status: 'completed',
          reference: `item-payout:${orderId}:${line.id}`, orderId, storeId: line.storeId,
          provider: 'escrow', note: `Cleared item payout: ${line.title}`, metadata: { lineId: line.id } }], { session })
        totalCredited += amount
        creditedWalletUserIds.push(userId)
      }
      line.settledAt = new Date()
    }
    const completed = order.protectionLines.length > 0 && order.protectionLines.every((l: any) => l.cancelled || l.settledAt || (l.refundedQuantity || 0) >= l.quantity)
    if (completed) { order.paymentStatus = 'released'; order.releasedAt = new Date(); order.status = 'completed' }
    return { success: completed, totalCredited, buyerId: String(order.customerId), creditedWalletUserIds, reason: completed ? 'cleared' : 'items_pending_clearance' }
  })
  if (result && 'totalCredited' in result && result.totalCredited > 0) {
    try {
      const { processVendorReferral, processBuyerReferral } = await import('./referral/processReferral')
      for (const userId of [...new Set<string>(result.creditedWalletUserIds)]) await processVendorReferral(userId)
      if (result.success) await processBuyerReferral(result.buyerId, orderId)
    } catch (error) { console.error('[after-sales] referral follow-up failed', error) }
  }
  return result
}

// Called only after a verified logistics event or explicit admin proof review.
export async function recordProtectedDelivery(orderId: string, vendorId: string, storeId: string) {
  return mutateOrder(orderId, async order => {
    for (const line of order.protectionLines) {
      if (line.vendorId !== vendorId || (storeId && line.storeId !== storeId) || line.availableAt || line.cancelled) continue
      line.deliveredAt = new Date(); line.availableAt = afterHours(CLEARANCE_HOURS)
      order.protectionNotices.push({ reference: `delivery:${line.id}`, userIds: [String(order.customerId), line.vendorId], message: `${line.title} is confirmed delivered. Seller funds remain locked until ${line.availableAt.toISOString()}. Report an issue from your order to pause the affected payout. Your statutory rights remain unaffected.`, createdAt: new Date() })
    }
    const dates = order.protectionLines.filter((l: any) => l.availableAt && !l.settledAt).map((l: any) => new Date(l.availableAt).getTime())
    if (dates.length) order.escrowReleaseAt = new Date(Math.min(...dates))
    return { success: true }
  })
}

export async function changeCase(actor: Actor, input: any) {
  return mutateOrder(text(input.orderId, 100), async (order, session) => {
    const c = order.afterSalesCases.find((v: any) => v.id === input.caseId)
    requireValue(c, 'Case not found')
    const line = order.protectionLines.find((l: any) => l.id === c.lineId)
    const admin = actor.role === 'admin', buyer = actor.id === String(order.customerId), vendor = actor.id === c.vendorId
    requireValue(admin || buyer || vendor, 'Access denied')
    const note = text(input.note)
    const action = text(input.action, 80)
    if (c.status !== 'replacement_clearance' && c.deadline && new Date(c.deadline).getTime() < Date.now() && activeCase(c) && c.status !== 'admin_review') {
      c.status = 'admin_review'; event(c, 'system', 'Deadline missed; escalated for review')
    }
    if (action === 'message' || action === 'appeal') {
      requireValue(note, 'Enter a message')
      const additions = evidenceUrls(input.evidence || [])
      requireValue((c.evidence || []).length + additions.length <= 100, 'This case has reached its evidence limit; contact support for additional documents')
      requireValue(c.history.length < 200 || admin, 'Please contact support to continue this lengthy case')
      c.evidence = [...(c.evidence || []), ...additions]
      if (buyer && action === 'message' && c.status === 'replacement_clearance') { c.status = 'admin_review'; c.deadline = afterHours(48) }
      if (action === 'appeal') {
        requireValue(!c.appealedAt, 'An appeal is already recorded')
        c.appealedAt = new Date(); c.status = 'admin_review'; c.deadline = afterHours(48)
      }
      event(c, actor.id, note); return c
    }
    requireValue(activeCase(c), 'Case is closed')
    // Persist attachments for every successful decision, including responses and refunds.
    // Failed authorization or validation rolls this back with the order transaction.
    const additions = evidenceUrls(input.evidence || [])
    requireValue((c.evidence || []).length + additions.length <= 100, 'This case has reached its evidence limit; contact support for additional documents')
    c.evidence = [...(c.evidence || []), ...additions]
    if (action === 'offer_refund') {
      requireValue((admin || vendor) && !c.replacementTracking && note, 'Explain the refund alternative before replacement dispatch')
      c.status = 'awaiting_resolution'; c.deadline = afterHours(48); event(c, actor.id, note); return c
    }
    if (action === 'accept_refund') {
      requireValue(buyer && c.status === 'awaiting_resolution', 'Customer approval of the refund alternative required')
      if (c.stockReservedAt && !c.stockReleasedAt) await releaseStock(c, line, session)
      c.kind = 'return'; c.status = 'admin_review'; c.deadline = afterHours(48); event(c, actor.id, 'Customer accepted the refund alternative; return arrangements will be reviewed'); return c
    }
    if (action === 'respond') {
      requireValue((vendor || admin) && ['requested', 'admin_review'].includes(c.status), 'This case is not awaiting a vendor response')
      requireValue(note, 'Explain your response')
      if (vendor && input.vendorAgreement === 'accept_return') c.vendorPolicyConsent = true
      c.status = 'admin_review'; c.deadline = afterHours(48); event(c, actor.id, note); return c
    }
    if (action === 'extend_deadline') {
      requireValue(admin && note, 'Admin explanation required'); const hours = Number(input.hours);
      requireValue(Number.isFinite(hours) && hours >= 1 && hours <= 720, 'Choose 1–720 hours');
      if (c.resumeStatus) { c.status = c.resumeStatus; c.resumeStatus = undefined }
      c.deadline = afterHours(hours); event(c, actor.id, note); return c
    }
    if (action === 'waive_return') {
      requireValue(admin && note && evidenceUrls(input.evidence || []).length, 'Admin explanation and evidence required');
      c.returnWaivedAt = new Date(); c.status = 'admin_review'; event(c, actor.id, note); return c
    }
    if (action === 'accept_inspection') {
      requireValue(admin && c.inspection === 'contested' && note && evidenceUrls(input.evidence || []).length, 'Admin evidence and decision required');
      c.inspection = 'accepted'; event(c, actor.id, note); return c
    }
    if (action === 'approve_return') {
      requireValue(admin && ['requested', 'admin_review', 'awaiting_arrangements', 'awaiting_logistics'].includes(c.status), 'Admin review required before return arrangements')
      requireValue(['customer', 'vendor', 'courier'].includes(input.fault), 'Choose responsibility')
      requireValue(note, 'Record the decision and supporting evidence')
      if (c.requiresPolicyException) requireValue(c.vendorPolicyConsent, 'The voluntary return window has elapsed; obtain the vendor’s agreement to an exception')
      if (['change_of_mind', 'size_change'].includes(c.reason)) {
        requireValue(c.vendorPolicyConsent || (line.returnPolicy && (c.kind === 'replacement' ? line.returnPolicy.acceptExchanges : line.returnPolicy.acceptReturns)), 'Voluntary return policy is missing or excludes this request; review with the customer and seller')
      }
      requireValue(text(input.returnAddress, 500), 'Enter the agreed return address')
      requireValue(!['wrong_item', 'wrong_size', 'damaged', 'defective', 'not_as_described'].includes(c.reason) || input.fault !== 'customer', 'Resolve the fault evidence before approving customer-paid logistics')
      if (c.kind === 'replacement' && !c.stockReservedAt) {
        const product: any = await Product.findById(line.productId).session(session); requireValue(product, 'Replacement unavailable; offer a refund');
        const variants = (line.selectedVariants || []).map((v: any) => ({ ...v }));
        if (text(input.replacementVariantLabel) && text(input.replacementVariantValue)) {
          const selected = { label: text(input.replacementVariantLabel), value: text(input.replacementVariantValue) };
          const index = variants.findIndex((v: any) => v.label === selected.label); if (index < 0) variants.push(selected); else variants[index] = selected;
        }
        requireValue(!c.desiredVariant || (text(input.confirmedVariant) === c.desiredVariant && text(input.replacementVariantValue)), 'Confirm and select the requested replacement variant');
        for (const selected of variants) { const v = product.variants?.find((v: any) => v.label === selected.label && v.value === selected.value); requireValue(v && v.stock >= c.quantity, 'Replacement variant out of stock'); v.stock -= c.quantity }
        requireValue(product.stock === 9999 || product.stock >= c.quantity, 'Replacement out of stock');
        if (product.stock !== 9999) product.stock -= c.quantity; product.markModified('variants'); await product.save({ session });
        c.stockReservedAt = new Date(); c.replacementVariants = variants;
      }
      c.fault = input.fault; c.logisticsPayer = input.fault === 'customer' ? 'customer' : 'vendor'
      c.logisticsCents = cents(input.logisticsAmount || 0); c.returnAddress = text(input.returnAddress, 500)
      c.status = 'awaiting_arrangements'; c.deadline = afterHours(48)
      event(c, actor.id, note); return c
    }
    if (action === 'accept_arrangements') {
      requireValue(buyer && c.status === 'awaiting_arrangements', 'Customer approval of arrangements required')
      c.arrangementsAcceptedAt = new Date(); c.status = 'awaiting_logistics'; c.deadline = afterHours(48)
      event(c, actor.id, 'Customer accepted return address, payer and quoted logistics'); return c
    }
    if (action === 'confirm_logistics') {
      requireValue(admin && c.status === 'awaiting_logistics', 'Customer agreement is required before confirming logistics')
      requireValue(note && text(input.logisticsReference, 200) && text(input.courier, 100) && evidenceUrls(input.evidence || []).length, 'Provide the paid courier booking reference, courier, receipt and verification note')
      c.logisticsReference = text(input.logisticsReference, 200); c.arrangementCourier = text(input.courier, 100); c.logisticsVerifiedBy = actor.id;
      c.status = 'awaiting_return'; c.deadline = afterHours(5 * 24);
      event(c, actor.id, `Logistics verified for payer ${c.logisticsPayer}. ${note}`); return c
    }
    if (action === 'return_shipped') {
      requireValue((buyer || admin) && c.status === 'awaiting_return', 'Return is not ready for dispatch')
      requireValue(text(input.trackingNumber, 200) && text(input.courier, 100), 'Courier and tracking number required')
      c.returnTracking = { number: text(input.trackingNumber, 200), courier: text(input.courier, 100) }
      c.status = 'return_in_transit'; c.deadline = afterHours(7 * 24)
      event(c, actor.id, 'Return handed to courier; tracking awaits delivery verification'); return c
    }
    if (action === 'verify_return') {
      requireValue(admin && c.status === 'return_in_transit', 'Admin must verify tracked return delivery')
      requireValue(note && evidenceUrls(input.evidence || []).length, 'Delivery proof and verification note required')
      c.status = 'inspection'; c.deadline = afterHours(48)
      event(c, actor.id, note); return c
    }
    if (action === 'inspect') {
      requireValue((vendor || admin) && c.status === 'inspection', 'Return is not awaiting inspection')
      requireValue(['accepted', 'contested'].includes(input.inspection), 'Choose inspection outcome')
      requireValue(note, 'Describe the condition, accessories and item identity')
      const evidence = evidenceUrls(input.evidence || [])
      requireValue(input.inspection !== 'contested' || evidence.length, 'Evidence is required to contest a return')
      c.inspection = input.inspection; c.status = 'admin_review'; c.deadline = afterHours(48)
      event(c, actor.id, note); return c
    }
    if (action === 'refund') {
      requireValue(admin, 'Only an admin may finalize a refund')
      requireValue(note, 'Record the refund decision')
      requireValue(c.inspection === 'accepted' || c.returnWaivedAt, 'An accepted inspection or documented no-return exception is required')
      requireValue(!c.refundedAt, 'This request was already refunded')
      requireValue(c.status !== 'refund_pending' && !c.providerRefundId, 'A provider refund is already in progress for this request')
      const manualReference = text(input.providerRefundReference, 200)
      // Original-payment refunds go to Paystack automatically. A manually entered
      // reference is the escape hatch for a refund done outside the app (Paystack
      // dashboard, a failed API request retried by hand) and needs proof to match.
      if (c.refundMethod !== 'wallet' && manualReference) requireValue(evidenceUrls(input.evidence || []).length, 'A manually recorded provider refund needs settlement proof')
      requireValue(order.paymentStatus !== 'refunded' && !line.cancelled, 'Payment already refunded or cancelled')
      const amountCents = refundCents(line, c.quantity)
      const taxCents = Math.round((line.taxCents || 0) * ((line.refundedQuantity || 0) + c.quantity) / line.quantity) - (line.refundedTaxCents || 0)
      const shippingCents = cents(input.shippingRefundAmount || 0)
      const returnCostCents = cents(input.returnCostRefundAmount || 0)
      if (shippingCents || returnCostCents) requireValue(['vendor', 'courier'].includes(c.fault) && evidenceUrls(input.evidence || []).length, 'Fault decision and receipts required for logistics refunds')
      const leg = order.vendors.find((v: any) => String(v.vendorId) === line.vendorId && String(v.storeId || '') === line.storeId)
      const alreadyRefundedShipping = order.afterSalesCases.filter((v: any) => v.storeId === line.storeId && v.vendorId === line.vendorId).reduce((n: number, v: any) => n + (v.shippingRefundCents || 0), 0)
      requireValue(shippingCents <= Math.max(0, cents(leg?.shippingFee || 0) - alreadyRefundedShipping), 'Original delivery refund exceeds the unrefunded delivery charge')
      requireValue(returnCostCents <= (c.logisticsCents || 0), 'Return cost reimbursement exceeds the approved quote')
      const breakdown = { amountCents, taxCents, shippingCents, returnCostCents, totalKobo: amountCents + taxCents + shippingCents + returnCostCents }

      // Vendor-side funding is settled first, for every destination. If the vendor
      // can't cover a return-cost reimbursement or a late-claim recovery, we find out
      // here — before a single kobo has left for the customer — and fail closed.
      const vendorDebits = await debitVendorForRefund(order, c, line, breakdown, session)
      c.shippingRefundCents = shippingCents; c.returnCostRefundCents = returnCostCents

      if (c.refundMethod === 'wallet') {
        const credit = await User.updateOne({ _id: order.customerId }, { $inc: { walletBalance: breakdown.totalKobo / 100 } }, { session })
        requireValue(credit.matchedCount, 'Customer wallet not found')
        await finalizeRefundLedger(order, c, line, breakdown, session, { reference: `case-refund:${c.id}`, provider: 'wallet', actorId: actor.id })
        event(c, actor.id, note); return c
      }
      if (manualReference) {
        await finalizeRefundLedger(order, c, line, breakdown, session, { reference: `provider-refund:${manualReference}`, provider: 'original_payment', actorId: actor.id, providerRefundReference: manualReference })
        event(c, actor.id, note); return c
      }
      // Automatic provider refund. Only the *intent* is recorded inside this
      // transaction — the Paystack request itself is made afterwards by
      // submitPendingProviderRefund, outside any transaction, so that a transient
      // retry of this callback can never send the same refund twice.
      c.pendingRefund = { ...breakdown, vendorDebits, requestedBy: actor.id, decisionNote: note }
      c.providerRefundIntentAt = new Date()
      c.status = 'refund_pending'; c.deadline = afterHours(PROVIDER_REFUND_HOURS)
      event(c, actor.id, `${note} Refund of ₦${(breakdown.totalKobo / 100).toLocaleString('en-NG')} requested to the original payment method; awaiting provider confirmation.`)
      return c
    }
    if (action === 'replacement_shipped') {
      requireValue(admin && c.kind === 'replacement' && (c.inspection === 'accepted' || c.returnWaivedAt), 'Admin approval and accepted return required')
      requireValue(note && text(input.trackingNumber, 200) && text(input.courier, 100), 'Confirm reserved stock, selected variant, paid logistics and tracking')
      requireValue(c.stockReservedAt && !c.replacementTracking, 'Reserved stock required; shipment must not already exist')
      c.replacementTracking = { number: text(input.trackingNumber, 200), courier: text(input.courier, 100) }
      c.status = 'replacement_in_transit'; c.deadline = afterHours(7 * 24); event(c, actor.id, note); return c
    }
    if (action === 'verify_replacement') {
      requireValue(admin && c.status === 'replacement_in_transit', 'Admin delivery verification required')
      requireValue(note && evidenceUrls(input.evidence || []).length, 'Delivery proof required')
      c.status = 'replacement_clearance'; c.deadline = afterHours(48)
      line.availableAt = c.deadline; event(c, actor.id, note); return c
    }
    if (action === 'resolve' || action === 'reject') {
      requireValue(admin && note, 'Admin decision and explanation required')
      requireValue(!c.pendingRefund, 'A provider refund is in flight; wait for Paystack to confirm or fail it before closing this case')
      requireValue(action !== 'resolve' || c.kind !== 'replacement' || (c.status === 'replacement_clearance' && new Date(c.deadline).getTime() <= Date.now()), 'Replacement must complete its delivery clearance')
      if (c.stockReservedAt && !c.replacementTracking && !c.stockReleasedAt) await releaseStock(c, line, session)
      c.status = action === 'resolve' ? 'resolved' : 'rejected'; c.closedAt = new Date(); event(c, actor.id, note); return c
    }
    throw new Error('Unknown case action')
  })
}

// Everything the vendor owes on this refund — a return-courier reimbursement, or
// recovery of an already-paid-out item on a late claim — debited under $gte guards so
// an unfunded vendor fails closed. Returns exactly what was taken, so a provider
// refund that later fails can put it back to the kobo.
async function debitVendorForRefund(order: any, c: any, line: any, breakdown: any, session: mongoose.ClientSession) {
  const debits: Array<{ userId: string; inc: Record<string, number>; reference: string; note: string }> = []
  if (breakdown.returnCostCents) {
    const payer = await walletUser(line, session)
    const account: any = await User.findById(payer).session(session).lean()
    let remaining = breakdown.returnCostCents / 100
    const deductions: any = { walletBalance: -remaining }
    for (const bucket of ['earnedBalance', 'depositedBalance', 'prizeBalance']) { const part = Math.min(Math.max(0, Number(account?.[bucket] || 0)), remaining); deductions[bucket] = -part; remaining -= part }
    const debit = await User.updateOne({ _id: payer, walletBalance: { $gte: breakdown.returnCostCents / 100 } }, { $inc: deductions }, { session })
    requireValue(debit.modifiedCount, 'Return-cost reimbursement requires vendor funding before settlement')
    const entry = { userId: payer, inc: deductions, reference: `return-cost:${c.id}`, note: 'Approved return logistics reimbursement' }
    await WalletTransaction.create([{ userId: payer, type: 'purchase_debit', amount: breakdown.returnCostCents / 100, status: 'completed', reference: entry.reference, orderId: order.orderId, note: entry.note }], { session })
    debits.push(entry)
  }
  if (line.settledAt) {
    const userId = await walletUser(line, session), amount = breakdown.amountCents / 100
    const inc = { walletBalance: -amount, earnedBalance: -amount }
    const recovery = await User.updateOne({ _id: userId, walletBalance: { $gte: amount }, earnedBalance: { $gte: amount } }, { $inc: inc }, { session })
    requireValue(recovery.modifiedCount, 'Vendor recovery is not funded; keep case open for admin funding review')
    const entry = { userId, inc, reference: `case-recovery:${c.id}`, note: 'Refund recovery' }
    await WalletTransaction.create([{ userId, type: 'purchase_debit', amount, status: 'completed', reference: entry.reference, orderId: order.orderId, note: entry.note, metadata: { caseId: c.id } }], { session })
    debits.push(entry)
  }
  return debits
}

// The customer's money has moved (wallet credited, or Paystack confirmed). Record it
// against the line and close the case. Split out so the wallet path, the manual
// provider path and the automatic provider path all write the ledger identically.
async function finalizeRefundLedger(order: any, c: any, line: any, breakdown: any, session: mongoose.ClientSession, opts: { reference: string; provider: string; actorId: string; providerRefundReference?: string; providerRefundId?: number }) {
  const refundTotal = breakdown.totalKobo / 100
  await WalletTransaction.create([{ userId: order.customerId, type: 'escrow_refund', amount: refundTotal, status: 'completed', reference: opts.reference, orderId: order.orderId, note: `Item refund: ${line.title}`, provider: opts.provider, metadata: { caseId: c.id, lineId: line.id, actorId: opts.actorId, providerRefundReference: opts.providerRefundReference, providerRefundId: opts.providerRefundId } }], { session })
  line.refundedTaxCents = (line.refundedTaxCents || 0) + breakdown.taxCents
  line.refundedCents = (line.refundedCents || 0) + breakdown.amountCents; line.refundedQuantity = (line.refundedQuantity || 0) + c.quantity
  if (c.stockReservedAt && !c.replacementTracking && !c.stockReleasedAt) await releaseStock(c, line, session)
  c.status = 'refunded'; c.refundedAt = new Date(); c.refundedCents = breakdown.totalKobo
  // delete, not = undefined: a Mixed field set to undefined persists as null, which
  // still matches the reconciler's { $exists: true } and would be re-polled forever.
  delete c.pendingRefund; delete c.resumeStatus
}

async function revertVendorDebits(order: any, c: any, session: mongoose.ClientSession, reason: string) {
  for (const debit of c.pendingRefund?.vendorDebits || []) {
    const inc = Object.fromEntries(Object.entries(debit.inc).map(([k, v]) => [k, -Number(v)]))
    await User.updateOne({ _id: debit.userId }, { $inc: inc }, { session })
    await WalletTransaction.create([{ userId: debit.userId, type: 'vendor_credit', amount: -Number(debit.inc.walletBalance), status: 'completed', reference: `${debit.reference}:reversal`, orderId: order.orderId, note: `${debit.note} reversed: ${reason}`, metadata: { caseId: c.id } }], { session })
  }
}

// Phase two of an automatic provider refund. Runs *after* changeCase has committed the
// intent, and makes the Paystack request outside any transaction. Then a second
// transaction records the refund id, or reverts the vendor debits if Paystack refused.
export async function submitPendingProviderRefund(orderId: string, caseId: string) {
  await connectToDatabase()
  const order: any = await Order.findOne({ orderId }).lean()
  const c = order?.afterSalesCases?.find((v: any) => v.id === caseId)
  if (!c || c.status !== 'refund_pending' || c.providerRefundId || !c.pendingRefund) return { success: false, reason: 'not_pending' }
  const result = await initiateRefund({
    transactionReference: String(order.paymentReference || ''),
    amountKobo: c.pendingRefund.totalKobo,
    merchantNote: `Make It Sell case ${c.id}: ${c.title}`,
    customerNote: `Refund for ${c.title}`,
  })
  return mutateOrder(orderId, async (fresh, session) => {
    const current = fresh.afterSalesCases.find((v: any) => v.id === caseId)
    requireValue(current, 'Case not found')
    if (current.providerRefundId || current.refundedAt) return { success: true, reason: 'already_recorded' }
    if (result.success && result.refundId) {
      current.providerRefundId = result.refundId
      current.providerRefundStatus = result.status
      event(current, 'system', `Paystack accepted refund request #${result.refundId} (${result.status}). Funds reach the customer once the provider confirms.`)
      return { success: true, refundId: result.refundId }
    }
    const line = fresh.protectionLines.find((l: any) => l.id === current.lineId)
    await revertVendorDebits(fresh, current, session, result.message || 'provider declined')
    delete current.pendingRefund; delete current.providerRefundIntentAt
    current.status = 'admin_review'; current.deadline = afterHours(48)
    event(current, 'system', `Paystack did not accept the refund: ${result.message || 'unknown error'}. Vendor debits reversed; review and retry, or record a manual refund reference.`)
    return { success: false, reason: result.message, lineId: line?.id }
  })
}

// Shared by the Paystack webhook and the polling reconciler. Idempotent: a duplicate
// delivery of refund.processed, or a poll racing the webhook, applies the ledger once.
export async function applyProviderRefundOutcome(refundId: number, status: string, detail?: { amountKobo?: number; reason?: string }) {
  await connectToDatabase()
  const order: any = await Order.findOne({ 'afterSalesCases.providerRefundId': refundId }).select('orderId').lean()
  if (!order) return { success: false, reason: 'unknown_refund' }
  const settled = (REFUND_SETTLED_STATUSES as readonly string[]).includes(status)
  const failed = (REFUND_FAILED_STATUSES as readonly string[]).includes(status)
  if (!settled && !failed) return { success: true, reason: 'still_pending' }
  return mutateOrder(order.orderId, async (fresh, session) => {
    const c = fresh.afterSalesCases.find((v: any) => v.providerRefundId === refundId)
    requireValue(c, 'Case not found')
    if (c.refundedAt) return { success: true, reason: 'already_refunded' }
    c.providerRefundStatus = status
    const line = fresh.protectionLines.find((l: any) => l.id === c.lineId)
    if (settled) {
      requireValue(c.pendingRefund, 'Refund breakdown missing; record manually')
      if (detail?.amountKobo != null) requireValue(detail.amountKobo === c.pendingRefund.totalKobo, `Provider settled ₦${detail.amountKobo / 100} but ₦${c.pendingRefund.totalKobo / 100} was requested; review before closing`)
      await finalizeRefundLedger(fresh, c, line, c.pendingRefund, session, { reference: `provider-refund:${refundId}`, provider: 'original_payment', actorId: 'system', providerRefundId: refundId })
      event(c, 'system', `Paystack confirmed refund #${refundId} to the original payment method.`)
      return { success: true, reason: 'refunded' }
    }
    await revertVendorDebits(fresh, c, session, detail?.reason || 'provider reported failure')
    delete c.pendingRefund; delete c.providerRefundIntentAt
    c.status = 'admin_review'; c.resumeStatus = undefined; c.deadline = afterHours(48)
    event(c, 'system', `Paystack reported refund #${refundId} failed${detail?.reason ? `: ${detail.reason}` : ''}. Vendor debits reversed; review and retry, or record a manual refund reference.`)
    return { success: true, reason: 'failed' }
  })
}

// Cron safety net. Polls every unconfirmed provider refund, and escalates any intent
// that never received a Paystack id — the request may or may not have gone out, and
// the one thing we must not do is send it again.
export async function reconcilePendingProviderRefunds() {
  await connectToDatabase()
  const orders: any[] = await Order.find({ afterSalesCases: { $elemMatch: { pendingRefund: { $exists: true }, refundedAt: { $exists: false } } } }).select('orderId afterSalesCases').limit(200).lean()
  const summary = { polled: 0, settled: 0, failed: 0, escalated: 0 }
  for (const o of orders) for (const c of o.afterSalesCases || []) {
    if (!c.pendingRefund || c.refundedAt) continue
    if (c.providerRefundId) {
      const fetched = await fetchRefund(c.providerRefundId)
      if (!fetched.success || !fetched.status) continue
      summary.polled += 1
      const outcome = await applyProviderRefundOutcome(c.providerRefundId, fetched.status, { amountKobo: fetched.amountKobo })
      if (outcome.reason === 'refunded') summary.settled += 1
      if (outcome.reason === 'failed') summary.failed += 1
      continue
    }
    const intentAge = Date.now() - new Date(c.providerRefundIntentAt || 0).getTime()
    if (intentAge < PROVIDER_INTENT_GRACE_MINUTES * 60000) continue
    await mutateOrder(o.orderId, async (fresh, session) => {
      const current = fresh.afterSalesCases.find((v: any) => v.id === c.id)
      if (!current || current.providerRefundId || current.refundedAt || current.status !== 'refund_pending') return
      await revertVendorDebits(fresh, current, session, 'refund request unconfirmed')
      delete current.pendingRefund; delete current.providerRefundIntentAt
      current.status = 'admin_review'; current.deadline = afterHours(48)
      event(current, 'system', 'A provider refund was requested but never confirmed. Check Paystack for this charge before retrying, then retry or record the reference manually.')
      summary.escalated += 1
    })
  }
  return summary
}

async function releaseStock(c: any, line: any, session: mongoose.ClientSession) {
  const product: any = await Product.findById(line.productId).session(session)
  if (product) { if (product.stock !== 9999) product.stock += c.quantity;
    for (const selected of c.replacementVariants || []) { const v = product.variants?.find((v: any) => v.label === selected.label && v.value === selected.value); if (v) v.stock += c.quantity }
    product.markModified('variants'); await product.save({ session })
  }
  c.stockReleasedAt = new Date()
}
export async function processAfterSalesDeadlines() {
  await connectToDatabase()
  const orders: any[] = await Order.find({ afterSalesCases: { $elemMatch: { status: { $nin: ['refunded', 'resolved', 'rejected', 'admin_review'] }, deadline: { $lte: new Date() } } } }).select('orderId').limit(500).lean()
  for (const o of orders) await mutateOrder(o.orderId, async order => {
    for (const c of order.afterSalesCases) {
      if (!activeCase(c) || !c.deadline || new Date(c.deadline).getTime() > Date.now()) continue
      if (c.status === 'replacement_clearance') { c.status = 'resolved'; c.closedAt = new Date(); event(c, 'system', 'Replacement clearance completed without another complaint') }
      else if (c.status !== 'admin_review') { c.resumeStatus = c.status; c.status = 'admin_review'; event(c, 'system', 'Deadline missed; admin review required') }
    }
  })
}

export async function sendProtectionNotices(orderId?: string) {
  const orders: any[] = await Order.find({ ...(orderId ? { orderId } : {}), protectionNotices: { $elemMatch: { sentAt: { $exists: false } } } }).select('orderId protectionNotices').limit(50).lean()
  for (const order of orders) for (const notice of order.protectionNotices || []) {
    if (notice.sentAt) continue
    try {
      const { emailService } = await import('./email')
      const users: any[] = await User.find({ _id: { $in: notice.userIds } }).select('email').lean()
      for (const user of users) {
        if (!user.email) continue
        const message = String(notice.message).replace(/[&<>]/g, (v: string) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[v]!))
        await emailService.sendEmail({ to: user.email, subject: 'Make It Sell purchase protection update', text: notice.message, html: `<p>${message}</p><p>Open Returns &amp; Replacements to view the next step.</p>` })
      }
      await Order.updateOne({ orderId: order.orderId }, { $set: { 'protectionNotices.$[notice].sentAt': new Date() } }, { arrayFilters: [{ 'notice.reference': notice.reference }] })
    } catch (error) { console.error('[after-sales] notification remains queued', error) }
  }
}

export async function clearVendorEarnings(userId: string) {
  await connectToDatabase()
  const linked: any[] = await Store.find({ linkedWalletUserId: userId }).select('vendorId').lean()
  const ownerIds = [...new Set([userId, ...linked.map(s => String(s.vendorId))])]
  const orders = Order.find({ paymentStatus: 'escrow', 'vendors.vendorId': { $in: ownerIds }, protectionLines: { $elemMatch: { availableAt: { $lte: new Date() }, settledAt: null } } }).select('orderId').lean().cursor()
  for await (const order of orders as any) await settleOrder(order.orderId)
}
