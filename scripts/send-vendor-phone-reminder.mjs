import { connectToDatabase } from '../lib/mongodb.ts'
import { User } from '../lib/models/User.ts'
import { emailService } from '../lib/email.ts'

function hasValidPhone(value) {
  const raw = String(value || '').trim()
  if (!raw) return false
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) return false
  if (/^(\d)\1+$/.test(digits)) return false
  return true
}

function buildEmailHtml({ loginUrl, logoUrl }) {
  return `<div style="background:#f6f7fb;padding:24px 0;font-family:Inter,Arial,sans-serif;color:#111827;">
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
}

const args = process.argv.slice(2)
const testEmail = args.includes('--test-email') ? args[args.indexOf('--test-email') + 1] : ''
const sendAll = args.includes('--send-all')

if (!testEmail && !sendAll) throw new Error('Use --test-email <email> or --send-all')

const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://makeitsell.vercel.app').replace(/\/$/, '')
const loginUrl = `${appUrl}/login`
const logoUrl = `${appUrl}/images/logo%20(2).png`

await connectToDatabase()
const vendors = await User.find({ role: 'vendor' }, { email: 1, phone: 1, phone_number: 1 }).lean()
const missingPhoneVendors = vendors.filter(v => !hasValidPhone(v.phone) && !hasValidPhone(v.phone_number))

console.log(`Vendors scanned: ${vendors.length}`)
console.log(`Vendors missing valid phone: ${missingPhoneVendors.length}`)

const subject = 'Important: Add your phone number to keep selling on Make It Sell'
const html = buildEmailHtml({ loginUrl, logoUrl })
const text = `Make It Sell is launching soon. Add your phone number now to keep receiving sales and rider pickups. Login: ${loginUrl}`

if (testEmail) {
  const ok = await emailService.sendEmail({ to: testEmail, subject, html, text })
  console.log(`Test email to ${testEmail}: ${ok ? 'sent' : 'failed'}`)
  process.exit(ok ? 0 : 1)
}

let sent = 0
let failed = 0
for (const vendor of missingPhoneVendors) {
  const to = String(vendor.email || '').trim()
  if (!to) continue
  const ok = await emailService.sendEmail({ to, subject, html, text })
  if (ok) sent += 1
  else failed += 1
}

console.log(`Done. sent=${sent} failed=${failed}`)
