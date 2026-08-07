import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { SupportTicket } from '@/lib/models/SupportTicket'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'

// Creates an escalation ticket — called by SupportChat.tsx when the AI can't resolve an
// issue. customerId/name/email always come from the session, never the request body, so
// a ticket can't be created under a spoofed identity.
export async function POST(request: NextRequest) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const subject = String(body.subject || '').trim().slice(0, 200)
    const description = String(body.description || '').trim().slice(0, 5000)

    if (!subject || !description) {
      return NextResponse.json({ error: 'subject and description are required' }, { status: 400 })
    }

    const priority = ['low', 'medium', 'high', 'urgent'].includes(body.priority) ? body.priority : 'medium'

    // Only the initial customer message from the chat transcript is trusted here —
    // sender identity for it is always this session, not whatever the client sent.
    const initialMessages = Array.isArray(body.messages)
      ? body.messages
          .filter((m: any) => m && typeof m.message === 'string' && m.message.trim())
          .map((m: any) => ({
            senderId: sessionUser.id,
            senderRole: 'customer' as const,
            message: m.message,
            timestamp: new Date(),
          }))
      : []

    await connectToDatabase()
    const ticket = await SupportTicket.create({
      customerId: sessionUser.id,
      customerName: sessionUser.name,
      customerEmail: sessionUser.email,
      subject,
      description,
      priority,
      status: 'open',
      escalatedFrom: 'ai',
      messages: initialMessages,
    })

    return NextResponse.json({ success: true, id: String(ticket._id), ticket })
  } catch (error: any) {
    console.error('[support-ticket] create error:', error?.message ?? error)
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 })
  }
}
