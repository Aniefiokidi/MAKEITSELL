import { NextRequest, NextResponse } from 'next/server'
import { requireCronOrAdminAccess } from '@/lib/server-route-auth'
import { connectToDatabase } from '@/lib/mongodb'
import { Cart } from '@/lib/models/Cart'
import { User } from '@/lib/models/User'
import { pushToUser } from '@/lib/push-notifications'
import { emailService } from '@/lib/email'

function recoveryEmail({ recipientName, items, appUrl }: { recipientName: string; items: any[]; appUrl: string }) {
  const rows = items
    .slice(0, 5)
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 14px;border:1px solid #e2e8f0">${String(item.title || 'Item').slice(0, 80)}</td>
          <td style="padding:10px 14px;border:1px solid #e2e8f0;text-align:right">₦${Number(item.price || 0).toLocaleString('en-NG')}</td>
        </tr>`
    )
    .join('')

  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#ffffff">
  <div style="background:#ffffff;padding:24px 32px;text-align:center;border-bottom:1px solid #f0f0f0">
    <img src="${appUrl}/images/logo.png" alt="Make It Sell" style="height:36px" />
  </div>
  <div style="border-top:3px solid #e53e3e">
    <div style="background:#7b1c1c;padding:20px 32px">
      <h2 style="color:#ffffff;margin:0;font-size:18px">You left something in your cart</h2>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 16px;color:#2d3748">Hi ${recipientName},</p>
      <p style="color:#4a5568">These items are still waiting in your cart:</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;border-radius:8px;overflow:hidden">
        ${rows}
      </table>
      ${items.length > 5 ? `<p style="color:#a0aec0;font-size:12px">+ ${items.length - 5} more item(s)</p>` : ''}
      <a href="${appUrl}/cart" style="display:inline-block;background:#e53e3e;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px">Complete Your Order</a>
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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://makeitsell.ng'

    // Once-daily cron, so use a generous window (3–30 hours since last touch) to make
    // sure every abandoned cart gets caught by exactly one run, similar to the booking
    // reminder job's 27-hour window for the same reason.
    const windowStart = new Date(now.getTime() - 30 * 60 * 60 * 1000)
    const windowEnd = new Date(now.getTime() - 3 * 60 * 60 * 1000)

    const candidates = await Cart.find({
      updatedAt: { $gte: windowStart, $lte: windowEnd },
      'items.0': { $exists: true },
    }).lean() as any[]

    let notified = 0

    for (const cart of candidates) {
      const items = Array.isArray(cart.items) ? cart.items : []
      if (items.length === 0) continue

      // Skip if we already sent a recovery notice for this exact cart state (nothing
      // added/changed since); re-fire only if the cart was touched again afterward.
      if (cart.recoveryEmailSentAt && new Date(cart.recoveryEmailSentAt) >= new Date(cart.updatedAt)) {
        continue
      }

      const user = await User.findById(cart.userId).select('name displayName email').lean() as any
      if (!user) continue

      const name = user.name || user.displayName || 'there'
      const itemCount = items.reduce((sum: number, i: any) => sum + Number(i.quantity || 1), 0)

      await Promise.allSettled([
        pushToUser(String(cart.userId), {
          title: 'You left something in your cart',
          body: `${itemCount} item${itemCount === 1 ? '' : 's'} waiting — come finish your order.`,
          url: '/cart',
          tag: `cart-recovery-${cart._id}`,
        }),
        user.email
          ? emailService.sendEmail({
              to: user.email,
              subject: 'You left something in your cart',
              html: recoveryEmail({ recipientName: name, items, appUrl }),
            })
          : Promise.resolve(),
      ])

      await Cart.updateOne({ _id: cart._id }, { $set: { recoveryEmailSentAt: now } })
      notified++
    }

    return NextResponse.json({ success: true, notified })
  } catch (error: any) {
    console.error('[abandoned-cart-job] failed:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Abandoned cart job failed' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
