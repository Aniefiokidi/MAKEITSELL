import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { Order } from '@/lib/models/Order'
import connectToDatabase from '@/lib/mongodb'
import { changeCase, openCase, mutateOrder, sendProtectionNotices } from '@/lib/after-sales'
import { initialLines, evidenceUrls, afterHours } from '@/lib/after-sales-policy'
import { enforceRateLimit } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  const actor = await getSessionUserFromRequest(request)
  if (!actor) return NextResponse.json({ error: 'Sign in to view requests' }, { status: 401 })
  const mode = request.nextUrl.searchParams.get('mode') || 'customer'
  if (mode === 'admin' && actor.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!['customer', 'vendor', 'admin'].includes(mode)) return NextResponse.json({ error: 'Invalid view' }, { status: 400 })
  try {
    await connectToDatabase()
    const query: any = mode === 'customer' ? { customerId: actor.id } : mode === 'vendor' ? { 'vendors.vendorId': actor.id } : { $or: [{ 'afterSalesCases.0': { $exists: true } }, { paymentStatus: 'escrow' }] }
    const orderId = request.nextUrl.searchParams.get('orderId')
    if (orderId) query.orderId = orderId
    const storeId = request.nextUrl.searchParams.get('storeId')
    const offset = Math.max(0, Math.min(100000, Number(request.nextUrl.searchParams.get('offset')) || 0))
    const orders: any[] = await Order.find(query).sort({ createdAt: -1 }).skip(offset).limit(50).lean()
    const visible = (line: any) => (mode !== 'vendor' || line.vendorId === actor.id) && (!storeId || line.storeId === storeId)
    return NextResponse.json({ success: true, nextOffset: orders.length === 50 ? offset + 50 : null, orders: orders.map(o => ({
      orderId: o.orderId, legacyDispute: !!o.disputeRaisedAt || o.disputeStatus === 'active', paymentStatus: o.paymentStatus, createdAt: o.createdAt,
      lines: (o.protectionLines?.length ? o.protectionLines : initialLines(o)).filter(visible),
      cases: (o.afterSalesCases || []).filter(visible).map((c: any) => ({ ...c,
        nextActor: ({ awaiting_resolution: 'Customer approval of refund alternative', requested: 'Vendor response', admin_review: 'Admin review', awaiting_logistics: 'Agreed payer and admin: courier booking verification', awaiting_arrangements: 'Customer approval', awaiting_return: 'Customer handover', return_in_transit: 'Courier delivery and admin verification', inspection: 'Vendor inspection', replacement_in_transit: 'Courier delivery and admin verification', replacement_clearance: 'Clearance period', refunded: 'Complete', resolved: 'Complete', rejected: 'Complete; appeal available' } as Record<string, string>)[c.status] || 'Admin review',
        history: (c.history || []).map((h: any) => ({ ...h, actorLabel: h.actor === 'system' ? 'System' : h.actor === String(o.customerId) ? 'Customer' : h.actor === c.vendorId ? 'Vendor' : 'Admin' }))
      })),
    })) })
  } catch (error) { console.error('[after-sales] list failed', error); return NextResponse.json({ error: 'Could not load requests' }, { status: 500 }) }
}
export async function POST(request: NextRequest) {
  const actor = await getSessionUserFromRequest(request)
  if (!actor) return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 })
  const limited = await enforceRateLimit(request, { key: 'after-sales', maxRequests: 20, windowMs: 60000 })
  if (limited) return limited
  try {
    const input = await request.json()
    if (input.action === 'migrate_dispute') {
      if (actor.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      await mutateOrder(String(input.orderId || ''), async () => ({ success: true }))
      return NextResponse.json({ success: true })
    }
    if (input.action === 'verify_delivery') {
      if (actor.role !== 'admin') return NextResponse.json({ error: 'Admin delivery verification required' }, { status: 403 })
      const proof = evidenceUrls(input.evidence || [])
      if (!proof.length || !String(input.note || '').trim()) throw new Error('Delivery proof and a verification note are required')
      await mutateOrder(String(input.orderId || ''), async order => {
        const line = order.protectionLines.find((l: any) => l.id === input.lineId)
        if (!line || line.cancelled) throw new Error('Item unavailable')
        if (!line.availableAt) {
          line.deliveryProof = { evidence: proof, note: String(input.note).slice(0, 2000), actorId: actor.id, at: new Date() }
          line.deliveredAt = new Date(); line.availableAt = afterHours(48)
          order.protectionNotices.push({ reference: `delivery:${line.id}`, userIds: [String(order.customerId), line.vendorId], message: `${line.title}: delivery verified. Seller funds remain locked until ${line.availableAt.toISOString()}. Report any issue from your order.`, createdAt: new Date() })
        }
      })
      return NextResponse.json({ success: true })
    }
    const result = input.action === 'create' ? await openCase(actor, input) : await changeCase(actor, input)
    await sendProtectionNotices(String(input.orderId || ''))
    return NextResponse.json({ success: true, case: result })
  } catch (error: any) {
    console.error('[after-sales] action failed', error)
    return NextResponse.json({ error: error?.code === 11000 ? 'This settlement has already been processed. Refresh to see its status.' : error?.message || 'Could not save request' }, { status: 400 })
  }
}
