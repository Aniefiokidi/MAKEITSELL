#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const dns = require('dns')
const { MongoClient } = require('mongodb')

dns.setServers(['8.8.8.8', '1.1.1.1'])

function loadEnv(f) {
  if (!fs.existsSync(f)) return
  for (const raw of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1)
    if (!(key in process.env)) process.env[key] = val
  }
}
loadEnv(path.join(process.cwd(), '.env.local'))
loadEnv(path.join(process.cwd(), '.env'))

const ACCENT = '#7f1d1d'
const LOGO = 'https://res.cloudinary.com/dgqxt06km/image/upload/q_auto/f_auto/v1778221830/logo_2_ovdgjg.png'
const APP_URL = 'https://www.makeitsell.ng'
const SUPPORT = 'support@makeitsell.ng'
const TEMP_PW = 'MIS-8A620EC6'

function buildHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your Make It Sell sign-in details</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden;">

  <tr><td style="background:#ffffff;padding:28px 24px 20px;text-align:center;border-bottom:3px solid ${ACCENT};">
    <img src="${LOGO}" alt="Make It Sell" width="120" style="display:block;margin:0 auto;border:0;" />
  </td></tr>

  <tr><td style="background:${ACCENT};color:#fff;padding:20px;text-align:center;">
    <h1 style="margin:0;font-size:22px;">Your Sign-in Details</h1>
    <p style="margin:8px 0 0;opacity:0.9;font-size:14px;">Make It Sell Platform Update</p>
  </td></tr>

  <tr><td style="padding:32px 28px 24px;">
    <p style="margin:0 0 16px;font-size:15px;color:#111827;">Hi <strong>A&amp;CO Logistics</strong>,</p>
    <p style="font-size:14px;color:#374151;line-height:1.75;margin:0 0 16px;">We recently completed a routine platform upgrade and your sign-in password was refreshed. Use the temporary password below to sign in and choose a new one.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      <tr><td align="center" style="background:#fdf8f8;border:2px dashed ${ACCENT};border-radius:10px;padding:22px;">
        <p style="margin:0 0 8px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Temporary Password</p>
        <p style="margin:0;font-size:26px;font-weight:700;letter-spacing:5px;color:${ACCENT};font-family:Courier New,Courier,monospace;">${TEMP_PW}</p>
      </td></tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px 22px;margin-bottom:24px;">
      <tr><td>
        <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#374151;">How to get back in:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
          <tr>
            <td style="width:30px;vertical-align:top;"><span style="display:inline-block;width:22px;height:22px;background:${ACCENT};color:#fff;border-radius:50%;text-align:center;line-height:22px;font-size:11px;font-weight:700;">1</span></td>
            <td style="padding-left:10px;font-size:13px;color:#374151;line-height:1.65;">Copy the temporary password above.</td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
          <tr>
            <td style="width:30px;vertical-align:top;"><span style="display:inline-block;width:22px;height:22px;background:${ACCENT};color:#fff;border-radius:50%;text-align:center;line-height:22px;font-size:11px;font-weight:700;">2</span></td>
            <td style="padding-left:10px;font-size:13px;color:#374151;line-height:1.65;">Visit <strong>makeitsell.ng/login</strong> and sign in with your email and the password above.</td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:30px;vertical-align:top;"><span style="display:inline-block;width:22px;height:22px;background:${ACCENT};color:#fff;border-radius:50%;text-align:center;line-height:22px;font-size:11px;font-weight:700;">3</span></td>
            <td style="padding-left:10px;font-size:13px;color:#374151;line-height:1.65;">You will be asked to choose a new password. Once done, you are all set.</td>
          </tr>
        </table>
      </td></tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr><td align="center">
        <a href="${APP_URL}/login" style="display:inline-block;background:${ACCENT};color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:13px 38px;border-radius:8px;">Sign in to Make It Sell</a>
      </td></tr>
    </table>

    <p style="margin:0 0 8px;font-size:13px;color:#6b7280;line-height:1.65;">Need help? Reply to this email or write to <a href="mailto:${SUPPORT}" style="color:${ACCENT};">${SUPPORT}</a>.</p>
    <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">We apologise for any inconvenience. Thank you for being part of the Make It Sell community.</p>
  </td></tr>

  <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 24px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">&copy; Make It Sell &middot; <a href="${APP_URL}" style="color:${ACCENT};text-decoration:none;">makeitsell.ng</a> &middot; 14 Admiralty Way, Lekki Phase 1, Lagos</p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`
}

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 2 })
  await client.connect()
  const db = client.db()

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM,
      to: ['Kingmishi456@gmail.com'],
      reply_to: SUPPORT,
      subject: 'Your Make It Sell sign-in details',
      html: buildHtml(),
      text: `Hi A&CO Logistics,\n\nYour temporary password: ${TEMP_PW}\n\n1. Copy the password above.\n2. Go to makeitsell.ng/login and sign in.\n3. You will be asked to set a new password.\n\nNeed help? Email ${SUPPORT}`,
      headers: {
        'List-Unsubscribe': `<mailto:${SUPPORT}?subject=unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Entity-Ref-ID': crypto.randomBytes(8).toString('hex'),
      },
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.id) {
    console.error('FAILED:', JSON.stringify(data))
    await client.close()
    process.exit(1)
  }

  console.log('Sent! Resend ID:', data.id)

  await db.collection('users').updateOne(
    { email: 'A&CO@makeitselll.org' },
    { $set: { securityNoticeSentAt: new Date() } }
  )
  console.log('securityNoticeSentAt marked.')
  await client.close()
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
