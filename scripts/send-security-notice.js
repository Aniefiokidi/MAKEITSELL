#!/usr/bin/env node
/**
 * Send security notice emails to users about the password reset.
 * Generates a fresh temp password per user, saves it to DB, and includes it in the email.
 *
 * Usage:
 *   node scripts/send-security-notice.js            ← test mode (2 addresses only)
 *   node scripts/send-security-notice.js --live     ← send to ALL users with mustChangePassword:true
 */

const fs       = require('fs')
const path     = require('path')
const dns      = require('dns')
const crypto   = require('crypto')
const nodemailer = require('nodemailer')
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
const APP_URL        = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.makeitsell.ng').replace(/\/$/, '')
const SUPPORT_EMAIL  = process.env.SUPPORT_EMAIL || 'support@makeitsell.ng'
const LOGO           = 'https://res.cloudinary.com/dgqxt06km/image/upload/q_auto/f_auto/v1778221830/logo_2_ovdgjg.png'
const ACCENT         = '#7f1d1d'

const IS_LIVE        = process.argv.includes('--live')

if (!RESEND_API_KEY) { console.error('ERROR: RESEND_API_KEY not set in .env.local'); process.exit(1) }
if (!MONGO_URI)      { console.error('ERROR: MONGODB_URI not set in .env.local');    process.exit(1) }

// ── Password helpers ──────────────────────────────────────────────────────────
function generateTempPassword() {
  return `MIS-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
}

function hashPassword(password) {
  // matches lib/password.ts exactly: scrypt$N$r$p$salt$hash
  const N = 16384, r = 8, p = 1
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64, { N, r, p }).toString('hex')
  return `scrypt$${N}$${r}$${p}$${salt}$${hash}`
}

// ── SMTP sender (fallback) ────────────────────────────────────────────────────
const smtpTransport = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST  || 'smtp.privateemail.com',
  port:   Number(process.env.EMAIL_PORT || 587),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || process.env.SMTP_USER || 'support@makeitsell.ng',
    pass: process.env.EMAIL_PASS || process.env.SMTP_PASS || '',
  },
})

async function sendEmailSmtp({ to, subject, html, text }) {
  const fromAddr = process.env.EMAIL_FROM || process.env.SMTP_FROM_EMAIL || 'Make It Sell <support@makeitsell.ng>'
  await smtpTransport.sendMail({
    from:    fromAddr,
    to,
    replyTo: SUPPORT_EMAIL,
    subject,
    html,
    text,
    headers: {
      'List-Unsubscribe':      `<mailto:${SUPPORT_EMAIL}?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      'X-Entity-Ref-ID':       crypto.randomBytes(8).toString('hex'),
    },
  })
  return 'smtp-ok'
}

// ── Resend sender ─────────────────────────────────────────────────────────────
async function sendEmailResend({ to, subject, html, text }) {
  const body = {
    from:     FROM,
    to:       [to],
    reply_to: SUPPORT_EMAIL,
    subject,
    html,
    text,
    headers: {
      'List-Unsubscribe':       `<mailto:${SUPPORT_EMAIL}?subject=unsubscribe>`,
      'List-Unsubscribe-Post':  'List-Unsubscribe=One-Click',
      'X-Entity-Ref-ID':        crypto.randomBytes(8).toString('hex'),
    },
  }

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok || !payload?.id)
    throw new Error(payload?.message || payload?.error || `HTTP ${res.status}`)
  return payload.id
}

async function sendEmail(opts) {
  try {
    return await sendEmailResend(opts)
  } catch (resendErr) {
    const msg = String(resendErr.message || '')
    if (msg.includes('not verified') || msg.includes('403') || msg.includes('domain')) {
      // Domain not verified in Resend — fall back to SMTP
      return await sendEmailSmtp(opts)
    }
    throw resendErr
  }
}

// ── Email template ────────────────────────────────────────────────────────────
function buildHtml(name, tempPassword) {
  const displayName = (name || 'Valued Customer').trim()
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>Your Make It Sell sign-in details</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px;">
  <tr><td align="center">
  <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden;">

    <!-- Logo: white background -->
    <tr><td style="background:#ffffff;padding:28px 24px 20px;text-align:center;border-bottom:3px solid ${ACCENT};">
      <img src="${LOGO}" alt="Make It Sell" width="120" style="display:block;margin:0 auto;border:0;" />
    </td></tr>

    <!-- Body -->
    <tr><td style="padding:32px 28px 24px;">
      <p style="margin:0 0 20px;font-size:15px;color:#111827;line-height:1.5;">
        Hi <strong>${displayName}</strong>,
      </p>
      <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.75;">
        We recently completed a routine platform upgrade and as part of this process your sign-in password was refreshed. We have prepared a temporary password for you to use right now.
      </p>
      <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.75;">
        Use it to sign in and you will be guided to choose a new password of your own — it only takes a minute.
      </p>

      <!-- Temp password box -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr><td align="center" style="background:#fdf8f8;border:2px dashed ${ACCENT};border-radius:10px;padding:22px;">
          <p style="margin:0 0 8px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Temporary Password</p>
          <p style="margin:0;font-size:26px;font-weight:700;letter-spacing:5px;color:${ACCENT};font-family:Courier New,Courier,monospace;">${tempPassword}</p>
        </td></tr>
      </table>

      <!-- Steps -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
        style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px 22px;margin-bottom:24px;">
        <tr><td>
          <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#374151;">How to get back in:</p>

          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
            <tr>
              <td style="width:30px;vertical-align:top;">
                <span style="display:inline-block;width:22px;height:22px;background:${ACCENT};color:#fff;border-radius:50%;text-align:center;line-height:22px;font-size:11px;font-weight:700;">1</span>
              </td>
              <td style="padding-left:10px;font-size:13px;color:#374151;line-height:1.65;">
                Copy the temporary password above.
              </td>
            </tr>
          </table>

          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
            <tr>
              <td style="width:30px;vertical-align:top;">
                <span style="display:inline-block;width:22px;height:22px;background:${ACCENT};color:#fff;border-radius:50%;text-align:center;line-height:22px;font-size:11px;font-weight:700;">2</span>
              </td>
              <td style="padding-left:10px;font-size:13px;color:#374151;line-height:1.65;">
                Visit <strong>makeitsell.org/login</strong> and sign in with your email and the password above.
              </td>
            </tr>
          </table>

          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:30px;vertical-align:top;">
                <span style="display:inline-block;width:22px;height:22px;background:${ACCENT};color:#fff;border-radius:50%;text-align:center;line-height:22px;font-size:11px;font-weight:700;">3</span>
              </td>
              <td style="padding-left:10px;font-size:13px;color:#374151;line-height:1.65;">
                You will be asked to choose a new password. Once done, you are all set.
              </td>
            </tr>
          </table>
        </td></tr>
      </table>

      <!-- CTA button -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr><td align="center">
          <a href="${APP_URL}/login"
            style="display:inline-block;background:${ACCENT};color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:13px 38px;border-radius:8px;">
            Sign in to Make It Sell
          </a>
        </td></tr>
      </table>

      <p style="margin:0 0 16px;font-size:13px;color:#6b7280;line-height:1.65;">
        If you need help, reply to this email or write to us at
        <a href="mailto:${SUPPORT_EMAIL}" style="color:${ACCENT};">${SUPPORT_EMAIL}</a>.
      </p>
      <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
        We apologise for any inconvenience. Thank you for being part of the Make It Sell community.
      </p>
    </td></tr>

    <!-- Footer -->
    <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 24px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        &copy; Make It Sell &middot;
        <a href="${APP_URL}" style="color:${ACCENT};text-decoration:none;">makeitsell.org</a>
        &middot; 14 Admiralty Way, Lekki Phase 1, Lagos
      </p>
      <p style="margin:6px 0 0;font-size:11px;color:#d1d5db;">
        You received this because you have an account on Make It Sell.
        To stop receiving emails reply with &ldquo;unsubscribe&rdquo;.
      </p>
    </td></tr>

  </table>
  </td></tr>
</table>
</body>
</html>`.trim()
}

function buildText(name, tempPassword) {
  const displayName = (name || 'Valued Customer').trim()
  return `Hi ${displayName},

We recently completed a routine platform upgrade and as part of this process your sign-in password was refreshed.

Your temporary password: ${tempPassword}

How to get back in:
1. Copy the temporary password above.
2. Go to ${APP_URL}/login and sign in with your email and the password above.
3. You will be asked to choose a new password. Once done, you are all set.

Need help? Write to us at ${SUPPORT_EMAIL} or reply to this email.

We apologise for any inconvenience. Thank you for being part of Make It Sell.

--
Make It Sell · makeitsell.org
14 Admiralty Way, Lekki Phase 1, Lagos
To stop receiving emails reply with "unsubscribe".
`.trim()
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
    let recipients // array of { email, name, tempPassword }

    if (IS_LIVE) {
      const EXCLUDE = ['orahlogistics@gmail.com']

      const users = await db.collection('users')
        .find({
          mustChangePassword: true,
          email: { $exists: true, $ne: '', $nin: EXCLUDE },
          securityNoticeSentAt: { $exists: false },  // skip already-sent users
        })
        .project({ _id: 1, email: 1, name: 1, displayName: 1, passwordHash: 1 })
        .toArray()

      console.log(`Found ${users.length} users still pending (not yet sent)\n`)

      recipients = []
      for (const u of users) {
        const email = String(u.email || '').trim().toLowerCase()
        if (!email) continue
        const tempPassword = generateTempPassword()
        const oldHash = String(u.passwordHash || '')
        await db.collection('users').updateOne(
          { _id: u._id },
          {
            $set: {
              passwordHash: hashPassword(tempPassword),
              ...(oldHash ? { previousPasswordHash: oldHash } : {}),
              mustChangePassword: true,
              temporaryPasswordIssuedAt: new Date(),
              updatedAt: new Date(),
            },
          }
        )
        recipients.push({ _id: u._id, email, name: u.name || u.displayName || '', tempPassword })
      }

    } else {
      // Test mode: get Arnold's record, generate fresh temp password for him
      const arnoldEmail  = 'arnoldeee123@gmail.com'
      const biolaEmail   = 'abiolak135@gmail.com'

      const arnoldUser = await db.collection('users').findOne(
        { email: { $regex: new RegExp(`^${arnoldEmail}$`, 'i') } },
        { projection: { _id: 1, name: 1, passwordHash: 1 } }
      )

      const sharedTempPassword = generateTempPassword()

      if (arnoldUser) {
        const oldHash = String(arnoldUser.passwordHash || '')
        await db.collection('users').updateOne(
          { _id: arnoldUser._id },
          {
            $set: {
              passwordHash: hashPassword(sharedTempPassword),
              ...(oldHash ? { previousPasswordHash: oldHash } : {}),
              mustChangePassword: true,
              temporaryPasswordIssuedAt: new Date(),
              updatedAt: new Date(),
            },
          }
        )
        console.log(`  Arnold DB updated with new temp password.\n`)
      } else {
        console.log(`  Arnold not found in DB — will still send test email.\n`)
      }

      recipients = [
        { email: biolaEmail,             name: 'Abiola', tempPassword: sharedTempPassword },
        { email: arnoldEmail,            name: 'Arnold', tempPassword: sharedTempPassword },
        { email: 'arnoldidiong@icloud.com', name: 'Arnold', tempPassword: sharedTempPassword },
      ]
      console.log(`TEST MODE — sending to: ${recipients.map(r => r.email).join(', ')}`)
      console.log(`Temp password used: ${sharedTempPassword}\n`)
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
          subject : 'Your Make It Sell sign-in details',
          html    : buildHtml(r.name, r.tempPassword),
          text    : buildText(r.name, r.tempPassword),
        })
        // Mark as sent so re-runs skip this user
        if (IS_LIVE && r._id) {
          await db.collection('users').updateOne(
            { _id: r._id },
            { $set: { securityNoticeSentAt: new Date() } }
          )
        }
        console.log('✓ SENT')
        sent++
      } catch (err) {
        console.log(`✗ FAILED: ${err.message}`)
        failed++
      }
      await new Promise(res => setTimeout(res, 300))
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
