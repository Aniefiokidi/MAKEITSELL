import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { emailService } from '@/lib/email'
import { requireAdminAccess } from '@/lib/server-route-auth'
import { getCanonicalAppBaseUrl } from '@/lib/app-url'

const hasValidPhone = (value: any) => {
  const raw = String(value || '').trim()
  if (!raw) return false
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) return false
  if (/^(\d)\1+$/.test(digits)) return false
  return true
}

const buildEmailHtml = (loginUrl: string, logoUrl: string) => `
  <div style="background:#f6f7fb;padding:24px 0;font-family:Inter,Arial,sans-serif;color:#111827;">
    <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="padding:22px 24px;background:#fff7ed;border-bottom:1px solid #fed7aa;text-align:center;">
        <img src="${logoUrl}" alt="Make It Sell" style="height:38px;max-width:220px;object-fit:contain;" />
      </div>
      <div style="padding:26px 24px;">
        <h2 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#7c2d12;">Action needed before launch 🚀</h2>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Make It Sell is launching really soon, and your vendor account needs a valid phone number so riders can call you for item pickup.</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;"><strong>If you don't add your phone number, you may miss sales opportunities.</strong></p>
        <div style="margin:22px 0;text-align:center;">
          <a href="${loginUrl}" style="display:inline-block;background:#ea580c;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700;">Log in and add phone number</a>
        </div>
      </div>
    </div>
  </div>`

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    const body = await request.json().catch(() => ({}))
    const mode = String(body?.mode || '').trim().toLowerCase()
    const testEmail = String(body?.testEmail || '').trim().toLowerCase()

    if (!['test', 'send_all'].includes(mode)) {
      return NextResponse.json({ success: false, error: 'mode must be test or send_all' }, { status: 400 })
    }

    if (mode === 'test' && !testEmail) {
      return NextResponse.json({ success: false, error: 'testEmail is required for test mode' }, { status: 400 })
    }

    await connectToDatabase()

    const baseUrl = getCanonicalAppBaseUrl().replace(/\/$/, '')
    const loginUrl = `${baseUrl}/login`
    const logoUrl = `${baseUrl}/images/logo%20(2).png`
    const subject = 'Important: Add your phone number to keep selling on Make It Sell'
    const html = buildEmailHtml(loginUrl, logoUrl)
    const text = `Make It Sell is launching soon. Add your phone number now to keep receiving sales and rider pickups. Login: ${loginUrl}`

    if (mode === 'test') {
      const ok = await emailService.sendEmail({ to: testEmail, subject, html, text })
      return NextResponse.json({ success: ok, mode, sent: ok ? 1 : 0, failed: ok ? 0 : 1, testEmail })
    }

    const vendors = await User.find({ role: 'vendor' }, { email: 1, phone: 1, phone_number: 1 }).lean()
    const missingPhoneVendors = vendors.filter((vendor: any) => !hasValidPhone(vendor?.phone) && !hasValidPhone(vendor?.phone_number))

    let sent = 0
    let failed = 0
    const recipients: string[] = []

    for (const vendor of missingPhoneVendors as any[]) {
      const to = String(vendor?.email || '').trim().toLowerCase()
      if (!to) continue
      const ok = await emailService.sendEmail({ to, subject, html, text })
      if (ok) {
        sent += 1
        recipients.push(to)
      } else {
        failed += 1
      }
    }

    return NextResponse.json({ success: true, mode, scanned: vendors.length, missingPhoneVendors: missingPhoneVendors.length, sent, failed, recipients })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to send vendor phone reminder emails' }, { status: 500 })
  }
}
