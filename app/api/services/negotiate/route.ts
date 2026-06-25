import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { connectToDatabase } from '@/lib/mongodb'
import { PriceNegotiation } from '@/lib/models/PriceNegotiation'
import { pushToUser } from '@/lib/push-notifications'
import { emailService } from '@/lib/email'
import { ObjectId } from 'mongodb'

function negotiationEmail({
  recipientName,
  otherParty,
  serviceName,
  basePrice,
  offeredPrice,
  message,
  isProvider,
}: {
  recipientName: string
  otherParty: string
  serviceName: string
  basePrice: number
  offeredPrice: number
  message: string
  isProvider: boolean
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://makeitsell.ng'
  const link = isProvider
    ? `${appUrl}/vendor/dashboard?tab=negotiations`
    : `${appUrl}/dashboard?tab=negotiations`

  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#ffffff">
  <div style="background:#ffffff;padding:24px 32px;text-align:center;border-bottom:1px solid #f0f0f0">
    <img src="${appUrl}/images/logo.png" alt="Make It Sell" style="height:36px" />
  </div>
  <div style="border-top:3px solid #e53e3e">
    <div style="background:#7b1c1c;padding:20px 32px">
      <h2 style="color:#ffffff;margin:0;font-size:18px">New Price Offer — ${serviceName}</h2>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 16px;color:#2d3748">Hi ${recipientName},</p>
      <p style="color:#4a5568"><strong>${otherParty}</strong> has made a price offer on <strong>${serviceName}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;border-radius:8px;overflow:hidden">
        <tr>
          <td style="padding:10px 14px;background:#f7fafc;font-weight:600;color:#4a5568;border:1px solid #e2e8f0;width:40%">Listed price</td>
          <td style="padding:10px 14px;border:1px solid #e2e8f0;color:#2d3748">₦${basePrice.toLocaleString('en-NG')}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#f7fafc;font-weight:600;color:#4a5568;border:1px solid #e2e8f0">Offered price</td>
          <td style="padding:10px 14px;border:1px solid #e2e8f0;color:#2f855a;font-weight:700;font-size:16px">₦${offeredPrice.toLocaleString('en-NG')}</td>
        </tr>
        ${message ? `<tr><td style="padding:10px 14px;background:#f7fafc;font-weight:600;color:#4a5568;border:1px solid #e2e8f0">Note</td><td style="padding:10px 14px;border:1px solid #e2e8f0;color:#4a5568;font-style:italic">"${message}"</td></tr>` : ''}
      </table>
      <a href="${link}" style="display:inline-block;background:#e53e3e;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px">View &amp; Respond</a>
      <p style="margin-top:24px;color:#a0aec0;font-size:12px">This negotiation expires in 48 hours.</p>
    </div>
  </div>
</div>`
}

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

  if (!serviceId || !amount || Number(amount) <= 0) {
    return NextResponse.json({ error: 'serviceId and a valid amount are required' }, { status: 400 })
  }

  const { db } = await connectToDatabase()

  let serviceDoc: any
  try {
    serviceDoc = await db.collection('services').findOne({ _id: new ObjectId(serviceId) })
  } catch {
    serviceDoc = await db.collection('services').findOne({ _id: serviceId as any })
  }
  if (!serviceDoc) return NextResponse.json({ error: 'Service not found' }, { status: 404 })

  const providerId = String(serviceDoc.providerId || serviceDoc.vendor_id || '')

  let providerEmail = serviceDoc.providerEmail || ''
  if (!providerEmail && providerId) {
    try {
      const p = await db.collection('users').findOne({ _id: new ObjectId(providerId) })
      providerEmail = p?.email || ''
    } catch {
      const p = await db.collection('users').findOne({ _id: providerId as any })
      providerEmail = p?.email || ''
    }
  }

  // Expire stale open negotiations for this service+customer
  await PriceNegotiation.updateMany(
    { serviceId, customerId: user.id, status: 'open', expiresAt: { $lt: new Date() } },
    { $set: { status: 'expired', updatedAt: new Date() } }
  )

  const alreadyOpen = await PriceNegotiation.findOne({ serviceId, customerId: user.id, status: 'open' })
  if (alreadyOpen) {
    return NextResponse.json(
      { error: 'You already have an open negotiation for this service', negotiationId: String(alreadyOpen._id) },
      { status: 409 }
    )
  }

  const offeredAmount = Number(amount)
  const basePrice = Number(serviceDoc.price || 0)

  const negotiation = await PriceNegotiation.create({
    serviceId,
    providerId,
    customerId: user.id,
    customerName: user.name || 'Customer',
    customerEmail: user.email,
    providerName: serviceDoc.providerName || 'Provider',
    providerEmail,
    serviceName: serviceDoc.title || 'Service',
    basePrice,
    messages: [
      {
        id: String(Date.now()),
        senderId: user.id,
        senderName: user.name || 'Customer',
        senderRole: 'customer',
        type: 'offer',
        amount: offeredAmount,
        text: text || '',
        createdAt: new Date(),
      },
    ],
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
  })

  if (providerId) {
    pushToUser(providerId, {
      title: 'New Price Offer',
      body: `${user.name || 'A customer'} offered ₦${offeredAmount.toLocaleString('en-NG')} for ${serviceDoc.title}`,
      url: '/vendor/dashboard?tab=negotiations',
      tag: `negotiation-${negotiation._id}`,
    }).catch(() => {})
  }

  if (providerEmail) {
    emailService.sendEmail({
      to: providerEmail,
      subject: `New price offer on "${serviceDoc.title}"`,
      html: negotiationEmail({
        recipientName: serviceDoc.providerName || 'Provider',
        otherParty: user.name || 'A customer',
        serviceName: serviceDoc.title,
        basePrice,
        offeredPrice: offeredAmount,
        message: text || '',
        isProvider: true,
      }),
    }).catch(() => {})
  }

  return NextResponse.json({ negotiation: negotiation.toObject() }, { status: 201 })
}
