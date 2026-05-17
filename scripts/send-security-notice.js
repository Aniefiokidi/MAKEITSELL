#!/usr/bin/env node
/**
 * Send security notice emails to users about the password reset.
 *
 * Usage:
 *   node scripts/send-security-notice.js            ← test mode (2 addresses only)
 *   node scripts/send-security-notice.js --live     ← send to ALL users with mustChangePassword:true
 */

const fs   = require('fs')
const path = require('path')
const dns  = require('dns')
const { MongoClient } = require('mongodb')

// ── Load .env / .env.local ────────────────────────────────────────────────────
function loadEnv(file) {
  if (!fs.existsSync(file)) return
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let val   = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1)
    if (!(key in process.env)) process.env[key] = val
  }
}
loadEnv(path.join(process.cwd(), '.env.local'))
loadEnv(path.join(process.cwd(), '.env'))

// ── Config ────────────────────────────────────────────────────────────────────
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const MONGO_URI      = process.env.MONGODB_URI || process.env.MONGO_URI || ''
const FROM           = process.env.RESEND_FROM || process.env.RESEND_DEFAULT_FROM || 'Make It Sell <verify@makeitsell.ng>'
const APP_URL        = (process.env.NEXT_PUBLIC_APP_URL || 'https://makeitsell.org').replace(/\/$/, '')
const SUPPORT_EMAIL  = process.env.SUPPORT_EMAIL || 'support@makeitsell.ng'
const LOGO           = 'https://res.cloudinary.com/dgqxt06km/image/upload/q_auto/f_auto/v1778221830/logo_2_ovdgjg.png'
const ACCENT         = '#7f1d1d'

const IS_LIVE        = process.argv.includes('--live')
const TEST_ADDRESSES = ['abiolak135@gmail.com', 'arnoldeee123@gmail.com']

if (!RESEND_API_KEY) { console.error('ERROR: RESEND_API_KEY not set in .env.local'); process.exit(1) }
if (!MONGO_URI)      { console.error('ERROR: MONGODB_URI not set in .env.local');    process.exit(1) }

// ── Resend sender ─────────────────────────────────────────────────────────────
async function sendEmail({ to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ from: FROM, to: [to], subject, html }),
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok || !payload?.id)
    throw new Error(payload?.message || payload?.error || `HTTP ${res.status}`)
  return payload.id
}

// ── Email template ────────────────────────────────────────────────────────────
function buildHtml(name) {
  const displayName = (name || 'Valued Customer').trim()
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
  <tr><td align="center">
  <table width="100%" style="max-width:580px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

    <!-- Header -->
    <tr><td style="background:${ACCENT};padding:32px 24px;text-align:center;">
      <img src="${LOGO}" alt="Make It Sell" style="height:52px;width:auto;display:block;margin:0 auto 14px;" />
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.3px;">
        Important Account Notice
      </h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">
        Security &amp; Quality Control Update
      </p>
    </td></tr>

    <!-- Body -->
    <tr><td style="padding:32px 28px;">
      <p style="margin:0 0 18px;font-size:15px;color:#111827;">
        Hi <strong>${displayName}</strong>,
      </p>
      <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.75;">
        As part of our scheduled <strong>security review and quality control process</strong>, we have performed a platform-wide account verification upgrade. As a standard precaution during this process, your account password was temporarily reset.
      </p>
      <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.75;">
        We sent you a temporary password — please follow the steps below to regain full access to your account.
      </p>

      <!-- Steps -->
      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:#fdf8f8;border:1px solid #fcd5d5;border-radius:10px;padding:24px;margin-bottom:24px;">
        <tr><td>
          <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:${ACCENT};">
            Steps to restore your account access:
          </p>

          <!-- Step 1 -->
          <table cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
            <tr>
              <td style="width:32px;vertical-align:top;padding-top:1px;">
                <span style="display:inline-block;width:24px;height:24px;background:${ACCENT};color:#fff;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;">1</span>
              </td>
              <td style="padding-left:10px;">
                <p style="margin:0;font-size:13px;color:#1f2937;line-height:1.65;">
                  <strong>Check your email inbox</strong> for a recent email from Make It Sell with the subject
                  <em>"Temporary Password"</em> or <em>"Account Password Reset"</em>.
                  It contains a code starting with <strong>MIS-</strong>.
                </p>
              </td>
            </tr>
          </table>

          <!-- Step 2 -->
          <table cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
            <tr>
              <td style="width:32px;vertical-align:top;padding-top:1px;">
                <span style="display:inline-block;width:24px;height:24px;background:${ACCENT};color:#fff;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;">2</span>
              </td>
              <td style="padding-left:10px;">
                <p style="margin:0;font-size:13px;color:#1f2937;line-height:1.65;">
                  <strong>Can't find it?</strong> Check your <strong>Spam</strong> or <strong>Junk</strong> folder.
                  Email filters sometimes move automated messages there automatically.
                  Look for any email from <em>makeitsell.ng</em> or <em>makeitsell.org</em>.
                </p>
              </td>
            </tr>
          </table>

          <!-- Step 3 -->
          <table cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
            <tr>
              <td style="width:32px;vertical-align:top;padding-top:1px;">
                <span style="display:inline-block;width:24px;height:24px;background:${ACCENT};color:#fff;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;">3</span>
              </td>
              <td style="padding-left:10px;">
                <p style="margin:0;font-size:13px;color:#1f2937;line-height:1.65;">
                  <strong>Sign in at Make It Sell</strong> using your email address and the temporary password
                  (the <strong>MIS-XXXX</strong> code from the email).
                </p>
              </td>
            </tr>
          </table>

          <!-- Step 4 -->
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:32px;vertical-align:top;padding-top:1px;">
                <span style="display:inline-block;width:24px;height:24px;background:${ACCENT};color:#fff;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;">4</span>
              </td>
              <td style="padding-left:10px;">
                <p style="margin:0;font-size:13px;color:#1f2937;line-height:1.65;">
                  You will be <strong>prompted to set a new password</strong> of your choice.
                  Once done, you are back in and your account is fully secured.
                </p>
              </td>
            </tr>
          </table>

        </td></tr>
      </table>

      <!-- CTA -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr><td align="center">
          <a href="${APP_URL}/login"
            style="display:inline-block;background:${ACCENT};color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:13px 36px;border-radius:8px;letter-spacing:0.2px;">
            Sign In to Make It Sell
          </a>
        </td></tr>
      </table>

      <!-- Support note -->
      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:8px;">
        <tr><td>
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#374151;">
            Still can't access your account?
          </p>
          <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.65;">
            If you have followed the steps above and still cannot log in, please contact our support team
            at <a href="mailto:${SUPPORT_EMAIL}" style="color:${ACCENT};font-weight:600;">${SUPPORT_EMAIL}</a>
            and we will assist you promptly.
          </p>
        </td></tr>
      </table>

      <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;line-height:1.6;">
        We apologise for any inconvenience this may have caused. Thank you for being part of the Make It Sell community.
      </p>
    </td></tr>

    <!-- Footer -->
    <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:18px 24px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        © Make It Sell ·
        <a href="${APP_URL}" style="color:${ACCENT};text-decoration:none;">makeitsell.org</a>
      </p>
    </td></tr>

  </table>
  </td></tr>
</table>
</body>
</html>`.trim()
}

// ── MongoDB ───────────────────────────────────────────────────────────────────
async function connectMongo() {
  const servers = (process.env.MONGODB_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map(s => s.trim()).filter(Boolean)
  if (servers.length) dns.setServers(servers)
  const client = new MongoClient(MONGO_URI, { maxPoolSize: 5 })
  await client.connect()
  return client
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n── Make It Sell · Security Notice Email ────────────────────────')
  console.log(IS_LIVE ? '  Mode : LIVE (all pending users)' : '  Mode : TEST (abiolak135 + arnoldeee123 only)')
  console.log('────────────────────────────────────────────────────────────────\n')

  console.log('Connecting to MongoDB...')
  const client = await connectMongo()
  const db     = client.db()

  try {
    let recipients // array of { email, name }

    if (IS_LIVE) {
      const users = await db.collection('users')
        .find({ mustChangePassword: true, email: { $exists: true, $ne: '' } })
        .project({ email: 1, name: 1, displayName: 1 })
        .toArray()

      recipients = users.map(u => ({
        email : String(u.email || '').trim().toLowerCase(),
        name  : u.name || u.displayName || '',
      })).filter(r => r.email)

      console.log(`Found ${recipients.length} users with mustChangePassword: true\n`)
    } else {
      recipients = [
        { email: 'abiolak135@gmail.com', name: 'Test User' },
        { email: 'arnoldeee123@gmail.com', name: 'Arnold' },
      ]
      console.log(`TEST MODE — sending only to: ${recipients.map(r => r.email).join(', ')}\n`)
    }

    if (recipients.length === 0) {
      console.log('No recipients. Nothing to send.')
      return
    }

    let sent = 0, failed = 0

    for (const r of recipients) {
      process.stdout.write(`  ${r.email.padEnd(40)} ... `)
      try {
        await sendEmail({
          to      : r.email,
          subject : 'Important: Make It Sell Account Security Update',
          html    : buildHtml(r.name),
        })
        console.log('✓ SENT')
        sent++
      } catch (err) {
        console.log(`✗ FAILED: ${err.message}`)
        failed++
      }
      // Small delay to respect rate limits
      await new Promise(r => setTimeout(r, 250))
    }

    console.log(`\n────────────────────────────────────────────────────────────────`)
    console.log(`  Sent   : ${sent}`)
    console.log(`  Failed : ${failed}`)
    console.log(`────────────────────────────────────────────────────────────────\n`)

    if (!IS_LIVE) {
      console.log('Test emails sent. Review them, then run with --live to send to everyone:')
      console.log('  node scripts/send-security-notice.js --live\n')
    }

  } finally {
    await client.close()
  }
}

main().catch(err => { console.error('\nFatal error:', err.message); process.exit(1) })
