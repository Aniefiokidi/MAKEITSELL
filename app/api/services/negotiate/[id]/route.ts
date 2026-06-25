import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { connectToDatabase } from '@/lib/mongodb'
import { PriceNegotiation } from '@/lib/models/PriceNegotiation'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await connectToDatabase()

  const negotiation = await PriceNegotiation.findById(id).lean()
  if (!negotiation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (negotiation.customerId !== user.id && negotiation.providerId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ negotiation })
}
