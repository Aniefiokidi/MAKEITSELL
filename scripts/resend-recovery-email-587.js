const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const dns = require('dns')
const { MongoClient } = require('mongodb')
const nodemailer = require('nodemailer')

const TARGET_EMAILS = [
  'busaritosinkafilat@gmail.com',
  'obiorachibueze8@gmail.com',
]

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  const out = {}
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i <= 0) continue
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    out[k] = v
  }
  return out
}

function isSrvDnsError(error) {
  const m = String((error && error.message) || error || '')
  return m.includes('querySrv ECONNREFUSED') || m.includes('querySrv ENOTFOUND') || m.includes('querySrv ETIMEOUT')
}

async function buildDirectUriFromSrv(srvUri, env) {
  const parsed = new URL(srvUri)
  const host = parsed.hostname
  const dbName = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.replace(/^\//, '') : (env.MONGODB_DB_NAME || 'test')
  const resolver = new dns.promises.Resolver()
  const servers = String(env.MONGODB_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((v) => v.trim()).filter(Boolean)
  if (servers.length > 0) resolver.setServers(servers)
  const srv = await resolver.resolveSrv(`_mongodb._tcp.${host}`)
  const hosts = srv.sort((a, b) => a.priority - b.priority).map((r) => `${r.name}:${r.port}`).join(',')
  const params = new URLSearchParams(parsed.searchParams)
  if (!params.has('retryWrites')) params.set('retryWrites', 'true')
  if (!params.has('w')) params.set('w', 'majority')
  if (!params.has('tls')) params.set('tls', 'true')
  const username = parsed.username ? encodeURIComponent(decodeURIComponent(parsed.username)) : ''
  const password = parsed.password ? encodeURIComponent(decodeURIComponent(parsed.password)) : ''
  const auth = username ? `${username}${password ? `:${password}` : ''}@` : ''
  return `mongodb://${auth}${hosts}/${dbName}?${params.toString()}`
}

async function connectMongo(uri, env) {
  try {
    const client = new MongoClient(uri, { maxPoolSize: 20 })
    await client.connect()
    return client
  } catch (e) {
    if (String(uri).startsWith('mongodb+srv://') && isSrvDnsError(e)) {
      const direct = await buildDirectUriFromSrv(uri, env)
      const client = new MongoClient(direct, { maxPoolSize: 20 })
      await client.connect()
      return client
    }
    throw e
  }
}

function hashPassword(password) {
  const N = 16384, r = 8, p = 1, keyLength = 64
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = crypto.scryptSync(password, salt, keyLength, { N, r, p }).toString('hex')
  return ['scrypt', String(N), String(r), String(p), salt, derived].join('$')
}

function genTemp() {
  return `MIS-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
}

async function run() {
  const env = {
    ...parseEnvFile(path.join(process.cwd(), '.env')),
    ...parseEnvFile(path.join(process.cwd(), '.env.local')),
    ...process.env,
  }

  const mongoUri = env.MONGODB_URI
  if (!mongoUri) throw new Error('Missing MONGODB_URI')

  const host = env.EMAIL_HOST || env.SMTP_HOST || 'smtp.privateemail.com'
  const user = env.EMAIL_USER || env.SMTP_USER
  const pass = env.EMAIL_PASS || env.SMTP_PASS
  const from = env.EMAIL_FROM || `"${env.SMTP_FROM_NAME || 'Make It Sell'}" <${env.SMTP_FROM_EMAIL || user}>`
  if (!user || !pass) throw new Error('Missing SMTP user/pass')

  const transporter = nodemailer.createTransport({
    host,
    port: 587,
    secure: false,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
  })

  await transporter.verify()

  const client = await connectMongo(mongoUri, env)
  const db = client.db()

  const users = await db.collection('users').find({ email: { $in: TARGET_EMAILS } }, { projection: { email: 1, name: 1, displayName: 1 } }).toArray()
  const out = []

  for (const u of users) {
    const email = String(u.email || '').toLowerCase()
    const name = String(u.name || u.displayName || 'User')
    const temp = genTemp()

    await db.collection('users').updateOne(
      { _id: u._id },
      {
        $set: {
          passwordHash: hashPassword(temp),
          mustChangePassword: true,
          temporaryPasswordIssuedAt: new Date(),
          isEmailVerified: true,
          emailVerificationToken: null,
          emailVerificationTokenExpiry: null,
          updatedAt: new Date(),
        },
      }
    )

    const subject = 'Important account recovery update from Make It Sell'
    const text = `Hello ${name}\n\nWe sincerely apologize that your OTP was not delivered earlier.\n\nTemporary password: ${temp}\n\nPlease sign in with your email and this temporary password, then change it immediately on the setup screen.\n\nMake It Sell Team`

    try {
      const info = await transporter.sendMail({ from, to: email, subject, text })
      out.push({ email, status: 'sent', messageId: info.messageId })
      console.log(`[EMAIL SENT] ${email}`)
    } catch (err) {
      out.push({ email, status: 'failed', reason: err && err.message ? err.message : String(err) })
      console.log(`[EMAIL FAILED] ${email}`)
    }
  }

  console.log(JSON.stringify({ processed: users.length, results: out }, null, 2))
  await client.close()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
