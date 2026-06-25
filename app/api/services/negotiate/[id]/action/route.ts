import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { connectToDatabase } from '@/lib/mongodb'
import { PriceNegotiation } from '@/lib/models/PriceNegotiation'
import { pushToUser } from '@/lib/push-notifications'
import { emailService } from '@/lib/email'

function actionEmail({
  recipientName,
  senderName,
  serviceName,
  type,
  amount,
  text,
  isRecipientProvider,
}: {
  recipientName: string
  senderName: string
  serviceName: string
  type: string
  amount: number | null
  text: string
  isRecipientProvider: boolean
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://makeitsell.ng'
  const link = isRecipientProvider
    ? `${appUrl}/vendor/dashboard?tab=negotiations`
    : `${appUrl}/dashboard?tab=negotiations`

  const color = type === 'accept' ? '#2f855a' : type === 'reject' ? '#c53030' : '#2b6cb0'
  const label =
    type === 'accept' ? 'Price Agreed ✓' :
    type === 'reject' ? 'Negotiation Ended' :
    'Counter-Offer Received'

  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#ffffff">
  <div style="background:#ffffff;padding:24px 32px;text-align:center;border-bottom:1px solid #f0f0f0">
    <img src="${appUrl}/images/logo.png" alt="Make It Sell" style="height:36px" />
  </div>
  <div style="border-top:3px solid #e53e3e">
    <div style="background:#7b1c1c;padding:20px 32px">
      <h2 style="color:#ffffff;margin:0;font-size:18px">${label} — ${serviceName}</h2>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 16px;color:#2d3748">Hi ${recipientName},</p>
      <p style="color:#4a5568"><strong>${senderName}</strong> has responded to the price negotiation for <strong>${serviceName}</strong>.</p>
      <div style="background:#f7fafc;border-left:4px solid ${color};padding:14px 18px;margin:20px 0;border-radius:0 6px 6px 0">
        <p style="margin:0;font-weight:700;color:${color};font-size:15px">${label}</p>
        ${amount ? `<p style="margin:6px 0 0;font-size:20px;font-weight:700;color:#2d3748">₦${Number(amount).toLocaleString('en-NG')}</p>` : ''}
        ${text ? `<p style="margin:8px 0 0;color:#4a5568;font-style:italic">"${text}"</p>` : ''}
      </div>
      ${type !== 'reject' ? `<a href="${link}" style="display:inline-block;background:#e53e3e;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px">
        ${type === 'accept' ? 'View Agreement' : 'View &amp; Respond'}
      </a>` : ''}
    </div>
  </div>
</div>`
}

// POST /api/services/negotiate/[id]/action
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { type, amount, text } = body

  if (!['offer', 'counter', 'accept', 'reject', 'note'].includes(type)) {
    return NextResponse.json({ error: 'Invalid action type' }, { status: 400 })
  }

  const { id } = await params
  await connectToDatabase()

  const negotiation = await PriceNegotiation.findById(id)
  if (!negotiation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (negotiation.customerId !== user.id && negotiation.providerId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (negotiation.status !== 'open') {
    return NextResponse.json(
      { error: `Negotiation is already ${negotiation.status}`, negotiation: negotiation.toObject() },
      { status: 409 }
    )
  }

  const senderRole = negotiation.customerId === user.id ? 'customer' : 'provider'

  negotiation.messages.push({
    id: String(Date.now()),
    senderId: user.id,
    senderName: user.name || (senderRole === 'customer' ? negotiation.customerName : negotiation.providerName),
    senderRole,
    type,
    amount: amount ? Number(amount) : null,
    text: text || '',
    createdAt: new Date(),
  } as any)

  if (type === 'accept') {
    const lastOtherOffer = [...negotiation.messages]
      .reverse()
      .find(m => m.senderRole !== senderRole && (m.type === 'offer' || m.type === 'counter' || m.type === 'accept'))
    negotiation.agreedPrice = amount ? Number(amount) : (lastOtherOffer?.amount ?? null)
    negotiation.status = 'agreed'
  } else if (type === 'reject') {
    negotiation.status = 'rejected'
  }

  await negotiation.save()

  const isCustomer = senderRole === 'customer'
  const otherPartyId = isCustomer ? negotiation.providerId : negotiation.customerId
  const otherPartyEmail = isCustomer ? negotiation.providerEmail : negotiation.customerEmail
  const otherPartyName = isCustomer ? negotiation.providerName : negotiation.customerName
  const senderName = user.name || (isCustomer ? negotiation.customerName : negotiation.providerName)

  const pushTitle =
    type === 'accept' ? `Price agreed on ${negotiation.serviceName}!` :
    type === 'reject' ? `Negotiation ended for ${negotiation.serviceName}` :
    `Counter-offer on ${negotiation.serviceName}`

  const pushBody =
    type === 'accept' ? `Both parties agreed on ₦${(negotiation.agreedPrice || 0).toLocaleString('en-NG')}` :
    type === 'reject' ? `${senderName} has ended the negotiation` :
    `${senderName} offered ₦${Number(amount || 0).toLocaleString('en-NG')}`

  if (otherPartyId) {
    pushToUser(otherPartyId, {
      title: pushTitle,
      body: pushBody,
      url: isCustomer ? '/vendor/dashboard?tab=negotiations' : '/dashboard?tab=negotiations',
      tag: `negotiation-${negotiation._id}`,
    }).catch(() => {})
  }

  if (otherPartyEmail && type !== 'note') {
    emailService.sendEmail({
      to: otherPartyEmail,
      subject:
        type === 'accept' ? `Price agreed for "${negotiation.serviceName}"` :
        type === 'reject' ? `Negotiation ended for "${negotiation.serviceName}"` :
        `Counter-offer on "${negotiation.serviceName}"`,
      html: actionEmail({
        recipientName: otherPartyName,
        senderName,
        serviceName: negotiation.serviceName,
        type,
        amount: amount ? Number(amount) : negotiation.agreedPrice,
        text: text || '',
        isRecipientProvider: !isCustomer,
      }),
    }).catch(() => {})
  }

  return NextResponse.json({ negotiation: negotiation.toObject() })
}
