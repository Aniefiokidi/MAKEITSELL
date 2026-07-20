import { NextRequest, NextResponse } from 'next/server'
import { requireCronOrAdminAccess } from '@/lib/server-route-auth'
import { connectToDatabase } from '@/lib/mongodb'
import { PriceNegotiation } from '@/lib/models/PriceNegotiation'
import { pushToUser } from '@/lib/push-notifications'
import { emailService } from '@/lib/email'

function expiryEmail({
  recipientName,
  serviceName,
  basePrice,
  lastOfferedPrice,
  isProvider,
}: {
  recipientName: string
  serviceName: string
  basePrice: number
  lastOfferedPrice: number | null
  isProvider: boolean
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://makeitsell.ng'

  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#ffffff">
  <div style="background:#ffffff;padding:24px 32px;text-align:center;border-bottom:1px solid #f0f0f0">
    <img src="${appUrl}/images/logo.png" alt="Make It Sell" style="height:36px" />
  </div>
  <div style="border-top:3px solid #e53e3e">
    <div style="background:#7b1c1c;padding:20px 32px">
      <h2 style="color:#ffffff;margin:0;font-size:18px">Negotiation Expired — ${serviceName}</h2>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 16px;color:#2d3748">Hi ${recipientName},</p>
      <p style="color:#4a5568">The price negotiation for <strong>${serviceName}</strong> has expired with no agreement reached within the 48-hour window.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;border-radius:8px;overflow:hidden">
        <tr>
          <td style="padding:10px 14px;background:#f7fafc;font-weight:600;color:#4a5568;border:1px solid #e2e8f0;width:40%">Listed price</td>
          <td style="padding:10px 14px;border:1px solid #e2e8f0;color:#2d3748">₦${basePrice.toLocaleString('en-NG')}</td>
        </tr>
        ${lastOfferedPrice ? `<tr><td style="padding:10px 14px;background:#f7fafc;font-weight:600;color:#4a5568;border:1px solid #e2e8f0">Last offer</td><td style="padding:10px 14px;border:1px solid #e2e8f0;color:#4a5568">₦${lastOfferedPrice.toLocaleString('en-NG')}</td></tr>` : ''}
      </table>
      <a href="${appUrl}${isProvider ? '/vendor/dashboard?tab=negotiations' : '/services'}" style="display:inline-block;background:#e53e3e;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px">${isProvider ? 'View Negotiations' : 'Start a New Offer'}</a>
    </div>
  </div>
</div>`
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireCronOrAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    await connectToDatabase()
    const now = new Date()

    // Proactive, global sweep — the negotiate routes only self-heal a single
    // service+customer pair lazily when someone happens to re-visit them, which
    // means a negotiation nobody revisits (e.g. a vendor who never opens their
    // negotiations tab) stays "open" forever with neither side ever told it
    // effectively died. This catches all of them, once a day, and notifies both sides.
    const stale = await PriceNegotiation.find({
      status: 'open',
      expiresAt: { $lt: now },
    }).lean()

    let expired = 0

    for (const negotiation of stale as any[]) {
      await PriceNegotiation.updateOne(
        { _id: negotiation._id, status: 'open' },
        { $set: { status: 'expired', updatedAt: new Date() } }
      )
      expired++

      const lastOffer = [...(negotiation.messages || [])]
        .reverse()
        .find((m: any) => m.amount != null)?.amount ?? null

      await Promise.allSettled([
        pushToUser(negotiation.customerId, {
          title: 'Negotiation Expired',
          body: `Your offer on ${negotiation.serviceName} expired with no response.`,
          url: '/dashboard?tab=negotiations',
          tag: `negotiation-expired-${negotiation._id}`,
        }),
        negotiation.providerId
          ? pushToUser(negotiation.providerId, {
              title: 'Negotiation Expired',
              body: `The offer from ${negotiation.customerName} on ${negotiation.serviceName} expired.`,
              url: '/vendor/dashboard?tab=negotiations',
              tag: `negotiation-expired-prov-${negotiation._id}`,
            })
          : Promise.resolve(),
        negotiation.customerEmail
          ? emailService.sendEmail({
              to: negotiation.customerEmail,
              subject: `Your offer on "${negotiation.serviceName}" has expired`,
              html: expiryEmail({
                recipientName: negotiation.customerName || 'Customer',
                serviceName: negotiation.serviceName,
                basePrice: Number(negotiation.basePrice || 0),
                lastOfferedPrice: lastOffer,
                isProvider: false,
              }),
            })
          : Promise.resolve(),
        negotiation.providerEmail
          ? emailService.sendEmail({
              to: negotiation.providerEmail,
              subject: `A negotiation on "${negotiation.serviceName}" has expired`,
              html: expiryEmail({
                recipientName: negotiation.providerName || 'Provider',
                serviceName: negotiation.serviceName,
                basePrice: Number(negotiation.basePrice || 0),
                lastOfferedPrice: lastOffer,
                isProvider: true,
              }),
            })
          : Promise.resolve(),
      ])
    }

    return NextResponse.json({ success: true, expired })
  } catch (error: any) {
    console.error('[negotiation-expiry-job] failed:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Negotiation expiry job failed' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
