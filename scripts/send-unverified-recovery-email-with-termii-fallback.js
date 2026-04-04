const fs = require('fs')
const path = require('path')
const dns = require('dns')
const crypto = require('crypto')
const { MongoClient } = require('mongodb')
const nodemailer = require('nodemailer')

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  const out = {}
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
    out[key] = value
  }
  return out
}

function isSrvDnsError(error) {
  const message = String((error && error.message) || error || '')
  return message.includes('querySrv ECONNREFUSED') || message.includes('querySrv ENOTFOUND') || message.includes('querySrv ETIMEOUT')
}

function extractSearchParams(parsedUri) {
  const params = new URLSearchParams(parsedUri.searchParams)
  if (!params.has('retryWrites')) params.set('retryWrites', 'true')
  if (!params.has('w')) params.set('w', 'majority')
  if (!params.has('tls')) params.set('tls', 'true')
  return params
}

async function buildDirectUriFromSrv(srvUri, env) {
  const parsed = new URL(srvUri)
  const hostname = parsed.hostname
  const dbName = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.replace(/^\//, '') : (env.MONGODB_DB_NAME || 'test')

  const resolver = new dns.promises.Resolver()
  const configuredDnsServers = String(env.MONGODB_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((v) => v.trim()).filter(Boolean)
  if (configuredDnsServers.length > 0) resolver.setServers(configuredDnsServers)

  const srvRecords = await resolver.resolveSrv(`_mongodb._tcp.${hostname}`)
  if (!Array.isArray(srvRecords) || srvRecords.length === 0) {
    throw new Error('No MongoDB SRV records found for host')
  }

  const hosts = srvRecords.sort((a, b) => a.priority - b.priority).map((r) => `${r.name}:${r.port}`).join(',')
  const params = extractSearchParams(parsed)

  try {
    const txtRecords = await resolver.resolveTxt(hostname)
    if (Array.isArray(txtRecords) && txtRecords.length > 0) {
      const atlasTxt = txtRecords[0].join('')
      const atlasParams = new URLSearchParams(atlasTxt)
      atlasParams.forEach((value, key) => {
        if (!params.has(key)) params.set(key, value)
      })
    }
  } catch {
    // optional
  }

  const username = parsed.username ? encodeURIComponent(decodeURIComponent(parsed.username)) : ''
  const password = parsed.password ? encodeURIComponent(decodeURIComponent(parsed.password)) : ''
  const auth = username ? `${username}${password ? `:${password}` : ''}@` : ''

  return `mongodb://${auth}${hosts}/${dbName}?${params.toString()}`
}

async function connectMongoWithFallback(uri, env) {
  const baseOptions = { maxPoolSize: 20 }
  try {
    const client = new MongoClient(uri, baseOptions)
    await client.connect()
    return client
  } catch (error) {
    if (String(uri).startsWith('mongodb+srv://') && isSrvDnsError(error)) {
      const configuredDnsServers = String(env.MONGODB_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((v) => v.trim()).filter(Boolean)
      if (configuredDnsServers.length > 0) dns.setServers(configuredDnsServers)
      const directUri = await buildDirectUriFromSrv(uri, env)
      const fallbackClient = new MongoClient(directUri, baseOptions)
      await fallbackClient.connect()
      return fallbackClient
    }
    throw error
  }
}

function normalizeNigerianPhone(input) {
  const raw = String(input || '').trim()
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10 && /^[789]\d{9}$/.test(digits)) return `+234${digits}`
  if (digits.startsWith('0') && digits.length === 11) return `+234${digits.slice(1)}`
  if (digits.startsWith('234') && digits.length === 13) return `+${digits}`
  if (raw.startsWith('+234') && digits.length === 13) return `+${digits}`
  return null
}

function hashPassword(password) {
  const N = 16384
  const r = 8
  const p = 1
  const keyLength = 64
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = crypto.scryptSync(password, salt, keyLength, { N, r, p }).toString('hex')
  return ['scrypt', String(N), String(r), String(p), salt, derivedKey].join('$')
}

function generateTemporaryPassword() {
  return `MIS-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
}

function createTransportConfigs(env) {
  const force587Only = String(env.FORCE_SMTP_587_ONLY || '').toLowerCase() === 'true'
  const host = env.EMAIL_HOST || env.SMTP_HOST || 'smtp.gmail.com'
  const port = Number(env.EMAIL_PORT || env.SMTP_PORT || '587')
  const secure = String(env.SMTP_SECURE || env.EMAIL_SECURE || '').toLowerCase() === 'true' || port === 465
  const user = env.EMAIL_USER || env.SMTP_USER
  const pass = env.EMAIL_PASS || env.SMTP_PASS
  if (!user || !pass) throw new Error('Missing SMTP credentials')

  const base = {
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
  }

  const fallback587 = { ...base, port: 587, secure: false }
  const fallback465 = { ...base, port: 465, secure: true }

  const unique = []
  const seen = new Set()
  const configs = force587Only ? [fallback587] : [base, fallback587, fallback465]
  for (const cfg of configs) {
    const key = `${cfg.host}:${cfg.port}:${cfg.secure}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(cfg)
  }
  return unique
}

async function sendEmailWithFallback(env, to, name, tempPassword) {
  const from = env.EMAIL_FROM || `"${env.SMTP_FROM_NAME || 'Make It Sell'}" <${env.SMTP_FROM_EMAIL || env.EMAIL_USER || env.SMTP_USER}>`
  const subject = 'Important account recovery update from Make It Sell'
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <p>Hello ${name},</p>
      <p>We sincerely apologize that your OTP was not delivered earlier.</p>
      <p>We have prepared your account for secure access:</p>
      <p><strong>Temporary password:</strong> ${tempPassword}</p>
      <p>Please sign in with your email and this temporary password, then change it immediately on the setup screen.</p>
      <p>Thank you for your patience.<br/>Make It Sell Team</p>
    </div>
  `
  const text = [
    `Hello ${name},`,
    'We sincerely apologize that your OTP was not delivered earlier.',
    `Temporary password: ${tempPassword}`,
    'Please sign in with your email and this temporary password, then change it immediately on the setup screen.',
    'Make It Sell Team',
  ].join('\n\n')

  const configs = createTransportConfigs(env)
  let lastError = null
  for (const cfg of configs) {
    try {
      const transporter = nodemailer.createTransport(cfg)
      await transporter.verify()
      const result = await transporter.sendMail({ from, to, subject, html, text })
      const accepted = Array.isArray(result.accepted) ? result.accepted : []
      const rejected = Array.isArray(result.rejected) ? result.rejected : []
      if (accepted.length > 0 && rejected.length === 0) {
        return { ok: true, transport: `${cfg.host}:${cfg.port}`, messageId: result.messageId }
      }
      lastError = `SMTP rejected recipient. accepted=${accepted.length} rejected=${rejected.length}`
    } catch (err) {
      lastError = err && err.message ? err.message : String(err)
    }
  }

  return { ok: false, error: lastError || 'SMTP send failed' }
}

async function sendTermiiSms(env, phoneNumber, tempPassword) {
  const apiKey = String(env.TERMII_API_KEY || '').trim()
  if (!apiKey) return { ok: false, error: 'TERMII_API_KEY missing' }

  const baseUrl = String(env.TERMII_BASE_URL || 'https://api.ng.termii.com').replace(/\/$/, '')
  const sender = String(env.TERMII_SENDER || 'MakeItSell').trim()
  const sms = [
    'Make It Sell update: We sincerely apologize that your OTP was not delivered earlier.',
    `Temporary password: ${tempPassword}`,
    'Sign in with your email and this password, then change it immediately on setup.',
  ].join(' ')

  const response = await fetch(`${baseUrl}/api/sms/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: phoneNumber,
      from: sender,
      sms,
      type: 'plain',
      channel: 'generic',
      api_key: apiKey,
    }),
  })

  const payload = await response.json().catch(() => ({}))
  const apiAccepted = payload?.status === 'success' || payload?.status === true || payload?.code === 'ok'
  if (response.ok && apiAccepted) return { ok: true }
  return { ok: false, error: payload?.message || payload?.error || `HTTP ${response.status}` }
}

async function run() {
  const env = {
    ...parseEnvFile(path.join(process.cwd(), '.env')),
    ...parseEnvFile(path.join(process.cwd(), '.env.local')),
    ...process.env,
  }

  const mongoUri = env.MONGODB_URI || env.MONGO_URI || env.MONGODB_URL
  if (!mongoUri) throw new Error('Missing MONGODB_URI')

  const limit = Math.max(1, Number(process.argv[2] || '5'))
  const explicitEmailsArg = String(process.argv[3] || '').trim()
  const inspectOnly = String(process.argv[4] || '').trim().toLowerCase() === '--inspect'
  const explicitEmails = explicitEmailsArg
    ? explicitEmailsArg.split(',').map((v) => v.trim().toLowerCase()).filter(Boolean)
    : []
  const client = await connectMongoWithFallback(mongoUri, env)
  const db = client.db()

  const query = explicitEmails.length > 0
    ? { email: { $in: explicitEmails } }
    : {
        $or: [{ isEmailVerified: { $exists: false } }, { isEmailVerified: false }],
        mustChangePassword: { $ne: true },
      }

  const users = await db.collection('users').find(
    query,
    { projection: { email: 1, name: 1, displayName: 1, phone: 1, phone_number: 1, createdAt: 1 } }
  ).sort({ createdAt: 1 }).limit(limit).toArray()

  if (inspectOnly) {
    console.log(JSON.stringify(
      users.map((u) => ({
        email: String(u.email || '').toLowerCase(),
        phone: u.phone || null,
        phone_number: u.phone_number || null,
        normalizedPhone: normalizeNigerianPhone(u.phone_number || u.phone),
      })),
      null,
      2
    ))
    await client.close()
    return
  }

  let processed = 0
  let emailSent = 0
  let smsFallbackSent = 0
  let failed = 0
  const details = []

  for (const user of users) {
    const email = String(user.email || '').trim().toLowerCase()
    const name = String(user.name || user.displayName || 'User')
    const phone = normalizeNigerianPhone(user.phone_number || user.phone)
    const tempPassword = generateTemporaryPassword()

    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash: hashPassword(tempPassword),
          mustChangePassword: true,
          temporaryPasswordIssuedAt: new Date(),
          isEmailVerified: true,
          emailVerificationToken: null,
          emailVerificationTokenExpiry: null,
          updatedAt: new Date(),
        },
      }
    )

    processed++
    const emailResult = await sendEmailWithFallback(env, email, name, tempPassword)
    if (emailResult.ok) {
      emailSent++
      details.push({ email, channel: 'email', status: 'sent', transport: emailResult.transport })
      console.log(`[EMAIL SENT] ${email}`)
      continue
    }

    if (phone) {
      const smsResult = await sendTermiiSms(env, phone, tempPassword)
      if (smsResult.ok) {
        smsFallbackSent++
        details.push({ email, channel: 'sms-fallback', status: 'sent' })
        console.log(`[SMS FALLBACK SENT] ${email} -> ${phone}`)
        continue
      }
      failed++
      details.push({ email, channel: 'email+sms-fallback', status: 'failed', reason: `email=${emailResult.error}; sms=${smsResult.error}` })
      console.log(`[FAILED] ${email}`)
      continue
    }

    failed++
    details.push({ email, channel: 'email', status: 'failed', reason: emailResult.error || 'SMTP failed and no valid phone for fallback' })
    console.log(`[FAILED EMAIL ONLY] ${email}`)
  }

  console.log('--- SUMMARY ---')
  console.log(JSON.stringify({ processed, emailSent, smsFallbackSent, failed, details }, null, 2))

  await client.close()
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
