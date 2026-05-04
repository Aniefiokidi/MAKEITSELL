import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/server-route-auth'
import { emailService } from '@/lib/email'
import { getCanonicalAppBaseUrl } from '@/lib/app-url'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'

type MissingPhoneEmailRequest = {
  mode?: 'test' | 'send_all'
  testEmail?: string
}

function hasValidPhone(value: unknown): boolean {
  const raw = String(value || '').trim()
  if (!raw) return false
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) return false
  if (/^(\d)\1+$/.test(digits)) return false
  return true
}

function buildEmailHtml(loginUrl: string, logoUrl: string) {
  const accent = '#5b2f21'
  return `<div style="background:#f6f7fb;padding:24px 0;font-family:Inter,Arial,sans-serif;color:#111827;">
    <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="padding:22px 24px;background:#fff7ed;border-bottom:1px solid #fed7aa;text-align:center;">
        <img src="${logoUrl}" alt="Make It Sell" style="height:38px;max-width:220px;object-fit:contain;" />
      </div>
      <div style="padding:26px 24px;">
        <h2 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#7c2d12;">Action needed before launch</h2>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Make It Sell is launching really soon, and your vendor account needs a valid phone number so riders can call you for item pickup.</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;"><strong>If you don't add your phone number, you may miss sales opportunities.</strong></p>
        <div style="margin:22px 0;text-align:center;">
          <a href="${loginUrl}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700;">Log in and add phone number</a>
        </div>
        <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">Need help? Contact <a href="mailto:support@makeitsell.ng" style="color:${accent};text-decoration:none;">support@makeitsell.ng</a>.</p>
      </div>
    </div>
  </div>`
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    const body = await request.json() as MissingPhoneEmailRequest
    const mode = body?.mode || 'test'
    const testEmail = String(body?.testEmail || '').trim().toLowerCase()

    if (mode !== 'test' && mode !== 'send_all') {
      return NextResponse.json({
        success: false,
        error: 'Unsupported mode. Use test or send_all.',
      }, { status: 400 })
    }

    if (!testEmail) {
      return NextResponse.json({
        success: false,
        error: 'testEmail is required for test mode',
      }, { status: 400 })
    }

    const appUrl = getCanonicalAppBaseUrl().replace(/\/$/, '')
    const loginUrl = `${appUrl}/login`
    const logoUrl = `${appUrl}/images/logo%20(2).png`
    const subject = 'Important: Add your phone number to keep selling on Make It Sell'
    const html = buildEmailHtml(loginUrl, logoUrl)
    const text = `Make It Sell is launching soon. Add your phone number now to keep receiving sales and rider pickups. Login: ${loginUrl}`
    const from = 'Make It Sell Support <support@makeitsell.ng>'

    if (mode === 'test') {
      const sent = await emailService.sendEmail({
        to: testEmail,
        subject,
        html,
        text,
        from,
        replyTo: 'support@makeitsell.ng',
      })

      if (!sent) {
        return NextResponse.json({
          success: false,
          mode,
          recipient: testEmail,
          sentCount: 0,
          failedCount: 1,
          from,
          error: emailService.getLastDeliveryError() || 'Email send failed',
        }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        mode,
        recipient: testEmail,
        sentCount: 1,
        failedCount: 0,
        from,
      })
    }

    await connectToDatabase()

    const vendors = await User.find(
      { role: 'vendor' },
      { email: 1, phone: 1, phone_number: 1 }
    ).lean()

    const missingPhoneVendors = vendors
      .filter((vendor: any) => !hasValidPhone(vendor?.phone) && !hasValidPhone(vendor?.phone_number))

    const recipients = Array.from(new Set([
      ...missingPhoneVendors
        .map((vendor: any) => String(vendor?.email || '').trim().toLowerCase())
        .filter(Boolean),
      testEmail,
    ]))

    let sentCount = 0
    let failedCount = 0
    const failedRecipients: string[] = []

    for (const recipient of recipients) {
      const sent = await emailService.sendEmail({
        to: recipient,
        subject,
        html,
        text,
        from,
        replyTo: 'support@makeitsell.ng',
      })

      if (sent) {
        sentCount += 1
      } else {
        failedCount += 1
        failedRecipients.push(recipient)
      }
    }

    if (failedCount > 0) {
      return NextResponse.json({
        success: false,
        mode,
        from,
        vendorScanCount: vendors.length,
        missingPhoneVendorCount: missingPhoneVendors.length,
        recipientCount: recipients.length,
        sentCount,
        failedCount,
        failedRecipients: failedRecipients.slice(0, 200),
        error: emailService.getLastDeliveryError() || 'One or more emails failed',
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      mode,
      from,
      vendorScanCount: vendors.length,
      missingPhoneVendorCount: missingPhoneVendors.length,
      recipientCount: recipients.length,
      testEmailIncluded: !!testEmail,
      sentCount,
      failedCount,
      recipientsSample: recipients.slice(0, 20),
      from,
    })
  } catch (error: any) {
    console.error('[admin/vendors/missing-phone-email][POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error?.message || 'Failed to send missing phone reminder email',
    }, { status: 500 })
  }
}