import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { SupportTicket } from '@/lib/models/SupportTicket'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { enforceRateLimit } from '@/lib/rate-limit'

// This endpoint didn't exist at all — the real Contact Us form (app/contact/page.tsx)
// has been POSTing here and silently treating every request as successful without
// checking the response, so every submission through it has been dropped in
// production. Fixed by actually creating the endpoint rather than leaving the form
// broken: it creates a SupportTicket, the same record type (and admin inbox) the AI
// chat's escalation path already uses — escalatedFrom: 'customer' is an enum value the
// schema already reserved for exactly this ("currently unused... kept so that surface
// doesn't need reshaping later"), just never wired up until now.
//
// Unlike /api/support/ticket, this one doesn't require a session — the real Contact Us
// form has no auth guard and is meant to work for anonymous visitors too. A logged-in
// caller's session identity is used when present; otherwise the submitted name/email is
// trusted the same way any anonymous contact form trusts its inputs (rate-limited
// below to bound abuse, since there's no session to rate-limit by account instead).
export async function POST(request: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(request, {
    key: 'contact-form',
    maxRequests: 5,
    windowMs: 60_000,
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = await request.json()
    const name = String(body?.name || '').trim().slice(0, 200)
    const email = String(body?.email || '').trim().slice(0, 200)
    const subject = String(body?.subject || '').trim().slice(0, 200)
    const message = String(body?.message || '').trim().slice(0, 5000)

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { success: false, error: 'name, email, subject and message are required' },
        { status: 400 }
      )
    }

    const sessionUser = await getSessionUserFromRequest(request)

    await connectToDatabase()
    const ticket = await SupportTicket.create({
      customerId: sessionUser?.id || `guest:${email.toLowerCase()}`,
      customerName: sessionUser?.name || name,
      customerEmail: sessionUser?.email || email,
      subject,
      description: message,
      priority: 'medium',
      status: 'open',
      escalatedFrom: 'customer',
      messages: [
        {
          senderId: sessionUser?.id || `guest:${email.toLowerCase()}`,
          senderRole: 'customer',
          message,
          timestamp: new Date(),
        },
      ],
    })

    return NextResponse.json({ success: true, id: String(ticket._id) })
  } catch (error: any) {
    console.error('[contact] create error:', error?.message ?? error)
    return NextResponse.json({ success: false, error: 'Failed to send message' }, { status: 500 })
  }
}
