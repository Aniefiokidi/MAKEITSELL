import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import connectToDatabase from '@/lib/mongodb'
import { SupportTicket } from '@/lib/models/SupportTicket'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'

// Appends one message to a ticket's conversation — shared by the customer-facing chat
// widget (customer replies, plus the AI/system messages it relays into the same thread)
// and the admin inbox's reply box.
//
// senderRole is taken from the request body (the chat widget already tags AI/system
// messages), but only within what the authenticated session is actually allowed to
// claim: 'admin' requires an admin session, everything else requires the caller to be
// this ticket's own customer. This stops a customer session from posting a message that
// displays as if it came from an admin.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const message = String(body.message || '').trim().slice(0, 5000)
    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    await connectToDatabase()
    const ticket: any = await SupportTicket.findById(id)
    if (!ticket) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const isOwner = ticket.customerId === sessionUser.id
    const isAdmin = sessionUser.role === 'admin'
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const requestedRole = ['customer', 'admin', 'ai', 'system'].includes(body.senderRole) ? body.senderRole : 'customer'
    const senderRole = requestedRole === 'admin' && !isAdmin ? 'customer' : requestedRole

    ticket.messages.push({
      senderId: senderRole === 'admin' ? sessionUser.id : (senderRole === 'customer' ? sessionUser.id : body.senderId || senderRole),
      senderRole,
      message,
      timestamp: new Date(),
    })
    ticket.updatedAt = new Date()
    // An admin reply moves a fresh ticket forward, matching the admin inbox's prior
    // (Firestore-era) behavior of marking a ticket in-progress the moment someone answers.
    if (senderRole === 'admin' && ticket.status === 'open') {
      ticket.status = 'in-progress'
    }
    await ticket.save()

    return NextResponse.json({ success: true, ticket: { ...ticket.toObject(), id: String(ticket._id) } })
  } catch (error: any) {
    console.error('[support-ticket-message] error:', error?.message ?? error)
    return NextResponse.json({ error: 'Failed to add message' }, { status: 500 })
  }
}
