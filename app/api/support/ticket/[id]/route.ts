import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import connectToDatabase from '@/lib/mongodb'
import { SupportTicket } from '@/lib/models/SupportTicket'
import { getSessionUserFromRequest, requireAdminAccess } from '@/lib/server-route-auth'

// Fetches a single ticket — the ticket's own customer (for the chat widget resuming a
// conversation, and the ticket detail page) or an admin (the admin support inbox).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectToDatabase()
  const ticket: any = await SupportTicket.findById(id).lean()
  if (!ticket) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (sessionUser.role !== 'admin' && ticket.customerId !== sessionUser.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ ...ticket, id: String(ticket._id) })
}

// Status changes — admin only (the admin inbox's status dropdown).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  const { id } = await params
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await request.json()
  if (!['open', 'in-progress', 'resolved', 'closed'].includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  await connectToDatabase()
  const ticket: any = await SupportTicket.findByIdAndUpdate(
    id,
    { status: body.status, updatedAt: new Date() },
    { new: true }
  ).lean()

  if (!ticket) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ ...ticket, id: String(ticket._id) })
}
