const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const dns = require('dns')
const mongoose = require('mongoose')

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  const out = {}
  const content = fs.readFileSync(filePath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const k = trimmed.slice(0, eq).trim()
    let v = trimmed.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    out[k] = v
  }
  return out
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
  const derived = crypto.scryptSync(password, salt, keyLength, { N, r, p }).toString('hex')
  return ['scrypt', String(N), String(r), String(p), salt, derived].join('$')
}

function isSrvDnsError(error) {
  const message = String((error && error.message) || error || '')
  return (
    message.includes('querySrv ECONNREFUSED') ||
    message.includes('querySrv ENOTFOUND') ||
    message.includes('querySrv ETIMEOUT')
  )
}

function configureDnsForSrv(env) {
  const configuredDnsServers = String(env.MONGODB_DNS_SERVERS || '8.8.8.8,1.1.1.1')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  if (configuredDnsServers.length > 0) {
    dns.setServers(configuredDnsServers)
  }
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
  const dbName = parsed.pathname && parsed.pathname !== '/'
    ? parsed.pathname.replace(/^\//, '')
    : (env.MONGODB_DB_NAME || 'test')

  const resolver = new dns.promises.Resolver()
  const configuredDnsServers = String(env.MONGODB_DNS_SERVERS || '8.8.8.8,1.1.1.1')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  if (configuredDnsServers.length > 0) {
    resolver.setServers(configuredDnsServers)
  }

  const srvRecords = await resolver.resolveSrv(`_mongodb._tcp.${hostname}`)
  if (!Array.isArray(srvRecords) || srvRecords.length === 0) {
    throw new Error('No MongoDB SRV records found for host')
  }

  const hosts = srvRecords
    .sort((a, b) => a.priority - b.priority)
    .map((record) => `${record.name}:${record.port}`)
    .join(',')

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
    // TXT lookup is optional.
  }

  const username = parsed.username ? encodeURIComponent(decodeURIComponent(parsed.username)) : ''
  const password = parsed.password ? encodeURIComponent(decodeURIComponent(parsed.password)) : ''
  const auth = username ? `${username}${password ? `:${password}` : ''}@` : ''

  return `mongodb://${auth}${hosts}/${dbName}?${params.toString()}`
}

async function connectMongoWithFallback(uri, env) {
  try {
    await mongoose.connect(uri)
    return
  } catch (error) {
    if (String(uri).startsWith('mongodb+srv://') && isSrvDnsError(error)) {
      configureDnsForSrv(env)
      const directUri = await buildDirectUriFromSrv(uri, env)
      await mongoose.connect(directUri)
      return
    }
    throw error
  }
}

function generateTemporaryPassword() {
  return `MIS-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
}

function buildMessage(tempPassword) {
  return [
    'Make It Sell update: We sincerely apologize that your OTP was not delivered earlier.',
    `Temporary password: ${tempPassword}`,
    'Sign in with your email and this password, then change it immediately on the setup screen.',
  ].join(' ')
}

async function sendTermiiSms({ baseUrl, apiKey, sender, to, sms }) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/sms/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to,
      from: sender,
      sms,
      type: 'plain',
      channel: 'generic',
      api_key: apiKey,
    }),
  })

  const payload = await response.json().catch(() => ({}))
  const accepted = payload?.status === 'success' || payload?.status === true || payload?.code === 'ok'
  return {
    ok: response.ok && accepted,
    status: response.status,
    payload,
  }
}

async function run() {
  const env = {
    ...parseEnvFile(path.join(process.cwd(), '.env')),
    ...parseEnvFile(path.join(process.cwd(), '.env.local')),
    ...process.env,
  }

  const mongoUri = env.MONGODB_URI || env.MONGODB_URL || env.MONGO_URI
  const termiiApiKey = env.TERMII_API_KEY
  const termiiBaseUrl = env.TERMII_BASE_URL || 'https://api.ng.termii.com'
  const sender = env.TERMII_SENDER || 'MakeItSell'
  const limit = Math.max(1, Number(process.argv[2] || '5'))

  if (!mongoUri) throw new Error('Missing MongoDB URI in env (.env/.env.local)')
  if (!termiiApiKey) throw new Error('Missing TERMII_API_KEY in env (.env/.env.local)')

  await connectMongoWithFallback(mongoUri, env)
  const db = mongoose.connection.db

  const candidates = await db.collection('users').find(
    {
      $or: [{ isEmailVerified: { $exists: false } }, { isEmailVerified: false }],
      mustChangePassword: { $ne: true },
    },
    {
      projection: {
        email: 1,
        name: 1,
        displayName: 1,
        phone: 1,
        phone_number: 1,
        createdAt: 1,
      },
    }
  ).sort({ createdAt: 1 }).limit(200).toArray()

  let sent = 0
  let failed = 0
  let updated = 0
  const failures = []

  for (const user of candidates) {
    if (sent >= limit) break

    const email = String(user.email || '')
    const name = String(user.name || user.displayName || 'User')
    const phone = normalizeNigerianPhone(user.phone_number || user.phone)

    if (!phone) {
      failures.push({ email, reason: 'No valid Nigerian phone' })
      continue
    }

    const tempPassword = generateTemporaryPassword()
    const passwordHash = hashPassword(tempPassword)

    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash,
          mustChangePassword: true,
          temporaryPasswordIssuedAt: new Date(),
          isEmailVerified: true,
          emailVerificationToken: null,
          emailVerificationTokenExpiry: null,
          updatedAt: new Date(),
        },
      }
    )
    updated++

    const sms = await sendTermiiSms({
      baseUrl: termiiBaseUrl,
      apiKey: termiiApiKey,
      sender,
      to: phone,
      sms: buildMessage(tempPassword),
    })

    if (sms.ok) {
      sent++
      console.log(`[SENT] ${email} -> ${phone}`)
    } else {
      failed++
      failures.push({
        email,
        phone,
        reason: sms.payload?.message || sms.payload?.error || `HTTP ${sms.status}`,
      })
      console.log(`[FAILED] ${email} -> ${phone}`)
    }
  }

  console.log('--- SUMMARY ---')
  console.log(JSON.stringify({
    requested: limit,
    updated,
    sent,
    failed,
    failureSamples: failures.slice(0, 20),
  }, null, 2))

  await mongoose.disconnect()
}

run().catch(async (err) => {
  console.error(err)
  try { await mongoose.disconnect() } catch {}
  process.exit(1)
})
