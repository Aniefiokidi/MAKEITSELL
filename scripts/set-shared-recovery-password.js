const fs = require('fs')
const path = require('path')
const dns = require('dns')
const crypto = require('crypto')
const { MongoClient } = require('mongodb')

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
  return (
    message.includes('querySrv ECONNREFUSED') ||
    message.includes('querySrv ENOTFOUND') ||
    message.includes('querySrv ETIMEOUT')
  )
}

function extractSearchParams(parsed) {
  const params = new URLSearchParams(parsed.searchParams)
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
    .map((v) => v.trim())
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
    // optional
  }

  const username = parsed.username ? encodeURIComponent(decodeURIComponent(parsed.username)) : ''
  const password = parsed.password ? encodeURIComponent(decodeURIComponent(parsed.password)) : ''
  const auth = username ? `${username}${password ? `:${password}` : ''}@` : ''

  return `mongodb://${auth}${hosts}/${dbName}?${params.toString()}`
}

async function connectMongoWithFallback(uri, env) {
  const options = { maxPoolSize: 20 }

  try {
    const client = new MongoClient(uri, options)
    await client.connect()
    return client
  } catch (error) {
    if (String(uri).startsWith('mongodb+srv://') && isSrvDnsError(error)) {
      const configuredDnsServers = String(env.MONGODB_DNS_SERVERS || '8.8.8.8,1.1.1.1')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
      if (configuredDnsServers.length > 0) {
        dns.setServers(configuredDnsServers)
      }

      const directUri = await buildDirectUriFromSrv(uri, env)
      const fallbackClient = new MongoClient(directUri, options)
      await fallbackClient.connect()
      return fallbackClient
    }

    throw error
  }
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

async function run() {
  const env = {
    ...parseEnvFile(path.join(process.cwd(), '.env')),
    ...parseEnvFile(path.join(process.cwd(), '.env.local')),
    ...process.env,
  }

  const mongoUri = env.MONGODB_URI || env.MONGO_URI || env.MONGODB_URL
  if (!mongoUri) throw new Error('Missing MONGODB_URI')

  const sharedPassword = String(process.argv[2] || '').trim()
  if (!sharedPassword) {
    throw new Error('Usage: node scripts/set-shared-recovery-password.js <sharedPassword>')
  }

  const targets = [
    'solaceokoye8@gmail.com',
    'busaritosinkafilat@gmail.com',
    'obiorachibueze8@gmail.com',
    'veecleanng@gmail.com',
  ]

  const client = await connectMongoWithFallback(mongoUri, env)
  const db = client.db()

  const passwordHash = hashPassword(sharedPassword)

  const updateResult = await db.collection('users').updateMany(
    { email: { $in: targets } },
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

  const updatedUsers = await db.collection('users').find(
    { email: { $in: targets } },
    { projection: { email: 1, mustChangePassword: 1, isEmailVerified: 1 } }
  ).toArray()

  console.log(JSON.stringify({
    success: true,
    matched: updateResult.matchedCount,
    modified: updateResult.modifiedCount,
    users: updatedUsers.map((u) => ({
      email: u.email,
      mustChangePassword: !!u.mustChangePassword,
      isEmailVerified: !!u.isEmailVerified,
    })),
  }, null, 2))

  await client.close()
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
