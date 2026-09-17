export const CLEARANCE_HOURS = 48
export const RESPONSE_HOURS = 48
export const RETURN_DAYS = 5
export const POLICY_MESSAGE = 'Seller funds remain locked for 48 hours after confirmed delivery. Report an issue to pause the affected payout. Your statutory rights remain unaffected.'
export const RETURN_MESSAGE = 'For eligible change-of-mind returns, you pay return delivery. Wrong or faulty items are handled at the responsible seller’s expense. Refunds follow inspection.'
export const REASONS = ['wrong_item', 'wrong_size', 'damaged', 'defective', 'not_as_described', 'not_received', 'change_of_mind', 'size_change', 'service_issue', 'other'] as const
export const CLOSED = ['refunded', 'resolved', 'rejected']
export const cents = (n: unknown) => { const v = Number(n); if (!Number.isFinite(v) || v < 0) throw new Error('Invalid amount'); return Math.round(v * 100) }
export const afterHours = (hours: number, now = new Date()) => new Date(now.getTime() + hours * 3600000)
export function activeCase(c: any) { return !CLOSED.includes(c.status) }
export function canClear(line: any, cases: any[], now = new Date()) {
  return !line.cancelled && !line.settledAt && !!line.availableAt && new Date(line.availableAt).getTime() <= now.getTime()
    && !cases.some(c => c.lineId === line.id && activeCase(c))
}
export function refundCents(line: any, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > line.quantity - (line.refundedQuantity || 0)) throw new Error('Invalid return quantity')
  // Cumulative allocation avoids rounding drift across multiple partial returns.
  const before = line.refundedQuantity || 0
  return Math.round(line.amountCents * (before + quantity) / line.quantity) - Math.round(line.amountCents * before / line.quantity)
}
export function evidenceUrls(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 5) throw new Error('Provide at most five evidence links')
  return value.map(v => { const url = new URL(String(v)); if (url.protocol !== 'https:') throw new Error('Evidence must use HTTPS'); return url.href })
}
export function initialLines(order: any) {
  const lines = (order.vendors || []).flatMap((leg: any, vi: number) => {
    const items = leg.items || []
    const subtotal = items.reduce((n: number, i: any) => n + cents(Number(i.price) * Number(i.quantity)), 0)
    // leg.total is accumulated as a float at order creation, while subtotal rounds each
    // line to kobo first — with fractional prices the two can legitimately disagree by
    // up to one kobo per item. Tolerate exactly that and clamp, so a rounding artefact
    // can never allocate more than the item subtotal; anything larger is a genuine
    // historical discrepancy and still fails closed for review.
    const rawPaid = cents(leg.total ?? subtotal / 100)
    if (rawPaid > subtotal + items.length) throw new Error('Historical item totals need reconciliation')
    const paid = Math.min(rawPaid, subtotal)
    let cumulative = 0
    return (leg.items || []).map((item: any, ii: number) => {
      const quantity = Number(item.quantity)
      if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error('Historical quantity needs review')
      const before = subtotal ? Math.round(paid * cumulative / subtotal) : 0
      cumulative += cents(Number(item.price) * quantity)
      return { id: `${vi}:${ii}`, vendorId: String(leg.vendorId), storeId: String(leg.storeId || ''),
        title: item.title || 'Item', productId: String(item.productId || ''), quantity,
        amountCents: (subtotal ? Math.round(paid * cumulative / subtotal) : 0) - before,
        selectedVariants: item.selectedVariants || [], snapshot: item.snapshot || null,
        returnPolicy: leg.returnPolicySnapshot || null, cancelled: leg.status === 'cancelled',
        refundedQuantity: 0, refundedCents: 0, refundedTaxCents: 0,
        availableAt: leg.protectionAvailableAt || null,
        settledAt: ['released', 'completed'].includes(order.paymentStatus) ? (order.releasedAt || order.createdAt) : null }
    })
  })
  const subtotal = lines.reduce((sum: number, l: any) => sum + l.amountCents, 0), tax = cents(order.vat || 0)
  if (subtotal + tax > cents(order.totalAmount)) throw new Error('Historical payment totals need reconciliation')
  let cumulative = 0
  return lines.map((line: any) => { const before = subtotal ? Math.round(tax * cumulative / subtotal) : 0; cumulative += line.amountCents; return { ...line, taxCents: (subtotal ? Math.round(tax * cumulative / subtotal) : 0) - before } })
}

// Read-side companion to initialLines. That function fails closed on an order whose
// historical totals don't reconcile — right for anything that moves money, but a
// listing must not collapse because one old order in the set needs a human look.
// Callers get the lines when they can be derived and a flag when they can't.
export function readableLines(order: any): { lines: any[]; needsReconciliation: boolean } {
  if (order.protectionLines?.length) return { lines: order.protectionLines, needsReconciliation: false }
  try { return { lines: initialLines(order), needsReconciliation: false } }
  catch { return { lines: [], needsReconciliation: true } }
}
