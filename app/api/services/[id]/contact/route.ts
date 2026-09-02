import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { ServiceContact } from '@/lib/models/ServiceContact'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { getServiceById } from '@/lib/mongodb-operations'

// POST — records that a buyer clicked through to WhatsApp for this service (fired
// alongside opening wa.me, not blocking it — see app/service/[id]/page.tsx). Upserted on
// (customerId, serviceId), so re-clicking "Book" on the same service never creates a
// duplicate, just refreshes contactedAt.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  await connectToDatabase()

  const service: any = await getServiceById(id)
  if (!service) {
    return NextResponse.json({ success: false, error: 'Service not found' }, { status: 404 })
  }

  const contact = await ServiceContact.findOneAndUpdate(
    { customerId: sessionUser.id, serviceId: id },
    {
      $set: { contactedAt: new Date() },
      $setOnInsert: {
        providerId: String(service.providerId || ''),
        serviceTitle: service.title || '',
        providerName: service.providerName || '',
        status: 'contacted',
      },
    },
    { upsert: true, new: true }
  )

  return NextResponse.json({ success: true, contact })
}

// PATCH — "mark as received," the buyer self-reporting the service actually happened.
// This is what unlocks the review form (app/api/services/[id]/can-review/route.ts).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  await connectToDatabase()

  const contact = await ServiceContact.findOneAndUpdate(
    { customerId: sessionUser.id, serviceId: id },
    { $set: { status: 'received', receivedAt: new Date() } },
    { new: true }
  )

  if (!contact) {
    return NextResponse.json(
      { success: false, error: "No WhatsApp contact found for this service yet — reply to the provider on WhatsApp first." },
      { status: 404 }
    )
  }

  return NextResponse.json({ success: true, contact })
}
