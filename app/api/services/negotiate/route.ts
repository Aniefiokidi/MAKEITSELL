import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { connectToDatabase } from '@/lib/mongodb'
import { PriceNegotiation } from '@/lib/models/PriceNegotiation'
import { createNegotiation } from '@/lib/negotiation-service'

// GET — check for existing open/agreed negotiation for this service + user
export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req)
  if (!user) return NextResponse.json({ negotiation: null }, { status: 401 })

  const serviceId = req.nextUrl.searchParams.get('serviceId')
  if (!serviceId) return NextResponse.json({ error: 'serviceId required' }, { status: 400 })

  await connectToDatabase()

  // Expire stale open negotiations
  await PriceNegotiation.updateMany(
    { serviceId, customerId: user.id, status: 'open', expiresAt: { $lt: new Date() } },
    { $set: { status: 'expired', updatedAt: new Date() } }
  )

  const existing = await PriceNegotiation.findOne({
    serviceId,
    customerId: user.id,
    status: { $in: ['open', 'agreed'] },
  })
    .sort({ createdAt: -1 })
    .lean()

  return NextResponse.json({ negotiation: existing || null })
}

// POST — start a new negotiation
export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { serviceId, amount, text } = body

  const result = await createNegotiation({
    serviceId: String(serviceId || ''),
    customerId: user.id,
    customerName: user.name || 'Customer',
    customerEmail: user.email,
    amount: Number(amount),
    text,
  })

  if (!result.success) {
    return NextResponse.json(
      { error: result.error, ...(result.negotiation ? { negotiationId: String(result.negotiation._id) } : {}) },
      { status: result.status }
    )
  }

  return NextResponse.json({ negotiation: result.negotiation }, { status: 201 })
}
