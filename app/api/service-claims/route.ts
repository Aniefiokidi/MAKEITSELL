import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import connectToDatabase from '@/lib/mongodb'
import { Booking } from '@/lib/models/Booking'
import { ServiceClaim } from '@/lib/models/ServiceClaim'
import { evidenceUrls } from '@/lib/after-sales-policy'
import mongoose from 'mongoose'
import { enforceRateLimit } from '@/lib/rate-limit'
const text = (v: unknown) => String(v || '').trim().slice(0, 2000)
export async function GET(request: NextRequest) {
  const user = await getSessionUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 })
  await connectToDatabase()
  const mode = request.nextUrl.searchParams.get('mode') || 'customer'
  if (mode === 'admin' && user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const query = mode === 'admin' ? {} : mode === 'vendor' ? { providerId: user.id } : { customerId: user.id }
  const claims = await ServiceClaim.find(query).sort({ updatedAt: -1 }).limit(100).lean()
  return NextResponse.json({ claims })
}
export async function POST(request: NextRequest) {
  const user = await getSessionUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 })
  const limited = await enforceRateLimit(request, { key: 'service-claims', maxRequests: 20, windowMs: 60000 })
  if (limited) return limited
  try {
    await connectToDatabase(); const body = await request.json()
    if (!mongoose.isValidObjectId(body.bookingId)) throw new Error('Invalid booking')
    const booking: any = await Booking.findById(body.bookingId).lean()
    if (!booking) throw new Error('Booking not found')
    const customer = String(booking.customerId) === user.id, provider = String(booking.providerId) === user.id, admin = user.role === 'admin'
    if (!customer && !provider && !admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (body.action === 'create') {
      if (!customer) throw new Error('Only the customer can report this booking')
      if (text(body.description).length < 10) throw new Error('Describe the service issue in at least 10 characters')
      if (!['reperformance', 'refund', 'other'].includes(body.requestedResolution)) throw new Error('Choose a resolution')
      const claim = await ServiceClaim.create({ bookingId: body.bookingId, customerId: user.id, providerId: booking.providerId, storeId: booking.storeId, title: booking.serviceTitle,
        description: text(body.description), requestedResolution: body.requestedResolution, evidence: evidenceUrls(body.evidence || []),
        paidOnline: booking.paymentStatus === 'paid' ? Number(booking.depositAmount || 0) + Number(booking.bookingFeeAmount || 0) : 0,
        history: [{ at: new Date(), actor: user.id, message: 'Service issue submitted. Admin will review the deposit and any documented offline payments separately.' }] })
      return NextResponse.json({ success: true, claim })
    }
    if (!text(body.note)) throw new Error('Enter a message')
    const allowed = ['message', ...(admin ? ['reperformance_agreed', 'resolved', 'rejected'] : [])]
    if (!allowed.includes(body.action)) throw new Error('Action not allowed')
    const update: any = { $push: { history: { at: new Date(), actor: user.id, message: text(body.note) } } }
    if (body.action !== 'message') update.$set = { status: body.action }
    const claim = await ServiceClaim.findOneAndUpdate({ bookingId: body.bookingId }, update, { new: true })
    if (!claim) throw new Error('Claim not found')
    return NextResponse.json({ success: true, claim })
  } catch (error: any) { return NextResponse.json({ error: error.code === 11000 ? 'A claim already exists for this booking; open the existing claim.' : error.message || 'Could not save claim' }, { status: 400 }) }
}
