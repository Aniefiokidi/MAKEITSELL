#!/usr/bin/env node
/**
 * Send test campaign emails (vendor + logistics) to arnoldeee123@gmail.com
 * Usage: node scripts/send-campaign-test.js
 */

const fs = require('fs')
const path = require('path')

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const content = fs.readFileSync(filePath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

const root = process.cwd()
loadEnvFile(path.join(root, '.env'))
loadEnvFile(path.join(root, '.env.local'))

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const FROM = process.env.RESEND_FROM || process.env.RESEND_DEFAULT_FROM || 'Make It Sell <verify@makeitsell.ng>'
const TEST_EMAIL = 'arnoldeee123@gmail.com'
const APP_BASE = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.makeitsell.ng').replace(/\/$/, '')
const LOGO_URL = 'https://res.cloudinary.com/dgqxt06km/image/upload/q_auto/f_auto/v1778221830/logo_2_ovdgjg.png'
const ACCENT = '#7f1d1d'
const WHATSAPP_URL = 'https://wa.me/2347078267836'
const WHATSAPP_NUMBER = '+234 707 826 7836'
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@makeitsell.ng'

if (!RESEND_API_KEY) {
  console.error('ERROR: RESEND_API_KEY not found in .env / .env.local')
  process.exit(1)
}

async function sendViaResend({ to, subject, html, text }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, text }),
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok || !payload?.id) {
    throw new Error(payload?.message || payload?.error || `HTTP ${res.status}`)
  }
  return payload.id
}

function vendorHtml(name) {
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
  <div style="background:${ACCENT};padding:28px 20px;text-align:center;">
    <div style="display:inline-block;background:#fff;border-radius:10px;padding:10px 16px;margin-bottom:14px;">
      <img src="${LOGO_URL}" alt="Make It Sell" style="height:44px;width:auto;display:block;" />
    </div>
    <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">Action Required — Test Phase Begins May 8</h1>
    <p style="color:rgba(255,255,255,.9);margin:8px 0 0 0;font-size:14px;">Important update for Make It Sell vendors</p>
  </div>
  <div style="padding:30px 28px;">
    <p style="margin:0 0 16px 0;color:#1f2937;font-size:15px;">Hi ${name},</p>
    <p style="margin:0 0 18px 0;color:#374151;font-size:15px;line-height:1.7;">
      We are excited to announce that <strong style="color:${ACCENT};">Make It Sell is entering its test phase</strong>. This is a major step forward, and your store plays a key role.
    </p>
    <div style="background:#fdf2f2;border-left:4px solid ${ACCENT};border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:22px;">
      <p style="margin:0;font-weight:700;color:${ACCENT};font-size:15px;">What's happening:</p>
      <p style="margin:8px 0 0 0;color:#374151;font-size:14px;line-height:1.7;">
        From <strong>Thursday May 8 to Wednesday May 13</strong>, the Make It Sell team will be placing orders from random vendor stores as part of the official test. Your store could be selected.
      </p>
    </div>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:22px;text-align:center;">
      <p style="margin:0;font-size:16px;font-weight:800;color:#166534;">🎉 Make It Sell is paying for all test orders</p>
      <p style="margin:8px 0 0 0;color:#374151;font-size:14px;line-height:1.7;">All purchases made during the test phase are fully covered by Make It Sell. You will receive payment for every order that comes through your store.</p>
    </div>
    <p style="margin:0 0 12px 0;color:#1f2937;font-size:15px;font-weight:700;">To qualify for the test, you must:</p>
    <ol style="margin:0 0 22px 0;padding-left:22px;color:#374151;font-size:14px;line-height:2.2;">
      <li><strong>Upload your phone number</strong> on your store profile — this is essential for delivery coordination</li>
      <li><strong>Complete your store setup</strong> — ensure your products have prices, images, and accurate descriptions</li>
      <li><strong>Contact us on WhatsApp</strong> to confirm your store is ready (details below)</li>
    </ol>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 8px 0;color:#166534;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:.05em;">Reach Out on WhatsApp</p>
      <p style="margin:0 0 14px 0;color:#374151;font-size:14px;line-height:1.6;">
        WhatsApp is the <strong>only way</strong> to confirm your store qualifies for the test phase.
      </p>
      <a href="${WHATSAPP_URL}" style="display:inline-block;background:#22c55e;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:700;">
        Chat on WhatsApp — ${WHATSAPP_NUMBER}
      </a>
    </div>
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${APP_BASE}/vendor/dashboard" style="display:inline-block;background:${ACCENT};color:#fff;text-decoration:none;padding:13px 32px;border-radius:8px;font-size:15px;font-weight:700;">
        Go to My Store Dashboard
      </a>
    </div>
    <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
      Questions? Email us at <a href="mailto:${SUPPORT_EMAIL}" style="color:${ACCENT};font-weight:600;">${SUPPORT_EMAIL}</a> or reach us on WhatsApp above.
    </p>
  </div>
  <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 24px;text-align:center;">
    <p style="margin:0;color:#9ca3af;font-size:12px;">Make It Sell Marketplace — Lagos, Nigeria</p>
  </div>
</div>`
}

function logisticsHtml(name) {
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
  <div style="background:${ACCENT};padding:28px 20px;text-align:center;">
    <div style="display:inline-block;background:#fff;border-radius:10px;padding:10px 16px;margin-bottom:14px;">
      <img src="${LOGO_URL}" alt="Make It Sell" style="height:44px;width:auto;display:block;" />
    </div>
    <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">Delivery Alert — Test Phase May 8–13</h1>
    <p style="color:rgba(255,255,255,.9);margin:8px 0 0 0;font-size:14px;">Heads up for ${name}</p>
  </div>
  <div style="padding:30px 28px;">
    <p style="margin:0 0 16px 0;color:#1f2937;font-size:15px;">Hi ${name},</p>
    <p style="margin:0 0 18px 0;color:#374151;font-size:15px;line-height:1.7;">
      This is an advance notice from <strong style="color:${ACCENT};">Make It Sell</strong>. We are entering our official <strong>test phase</strong> and want to keep you in the loop.
    </p>
    <div style="background:#fdf2f2;border-left:4px solid ${ACCENT};border-radius:0 8px 8px 0;padding:18px 20px;margin-bottom:24px;">
      <p style="margin:0 0 6px 0;font-weight:700;color:${ACCENT};font-size:16px;">Deliveries incoming: May 8 – May 13</p>
      <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;">
        During this window, test orders will be placed on the platform and will require delivery. You will receive individual order notification emails as orders come in, with all the details — customer address, vendor pickup location, items, and amounts.
      </p>
    </div>
    <p style="margin:0 0 14px 0;color:#374151;font-size:14px;line-height:1.7;">
      Please ensure your team is available and ready to handle deliveries during this period. Each order email will contain the full breakdown so there are no surprises.
    </p>
    <p style="margin:0 0 24px 0;color:#374151;font-size:14px;line-height:1.7;">
      If you have any questions or need to discuss logistics coordination, please reply to this email or reach us at
      <a href="mailto:${SUPPORT_EMAIL}" style="color:${ACCENT};font-weight:600;">${SUPPORT_EMAIL}</a>.
    </p>
    <p style="margin:0;color:#374151;font-size:15px;font-weight:600;">Thank you for your continued partnership.</p>
  </div>
  <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 24px;text-align:center;">
    <p style="margin:0;color:#9ca3af;font-size:12px;">Make It Sell Marketplace — Lagos, Nigeria</p>
  </div>
</div>`
}

async function main() {
  console.log('Sending test campaign emails to', TEST_EMAIL, '...\n')

  // Vendor test
  process.stdout.write('  [1/2] Vendor email ... ')
  try {
    const id = await sendViaResend({
      to: TEST_EMAIL,
      subject: 'Action Required — Make It Sell Test Phase Starts May 8',
      html: vendorHtml('Test Vendor'),
      text: `Hi Test Vendor,\n\nMake It Sell is entering its test phase.\nOrders coming May 8-13.\nUpload your phone number, complete store setup, and message us on WhatsApp: ${WHATSAPP_NUMBER}\n\nDashboard: ${APP_BASE}/vendor/dashboard`,
    })
    console.log('SENT  (id:', id + ')')
  } catch (err) {
    console.log('FAILED:', err.message)
  }

  // Logistics test
  process.stdout.write('  [2/2] Logistics email ... ')
  try {
    const id = await sendViaResend({
      to: TEST_EMAIL,
      subject: 'Delivery Alert — Make It Sell Test Phase May 8–13 (Test Logistics)',
      html: logisticsHtml('Test Logistics'),
      text: `Hi Test Logistics,\n\nMake It Sell test phase: May 8–13.\nDeliveries will be coming in during this window.\nYou will receive individual order emails with full details.\n\nContact: ${SUPPORT_EMAIL}`,
    })
    console.log('SENT  (id:', id + ')')
  } catch (err) {
    console.log('FAILED:', err.message)
  }

  console.log('\nDone. Check arnoldeee123@gmail.com.')
}

main().catch(err => { console.error(err); process.exit(1) })
