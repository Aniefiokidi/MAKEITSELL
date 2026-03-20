const fs = require('fs')
const path = require('path')
const dns = require('dns')
const mongoose = require('mongoose')

dns.setServers(['8.8.8.8', '1.1.1.1'])

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const eqIndex = line.indexOf('=')
    if (eqIndex < 0) continue

    const key = line.slice(0, eqIndex).trim()
    let value = line.slice(eqIndex + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

function normalizeBaseUrl(url) {
  return String(url || 'https://api.xoropay.com').trim().replace(/\/+$/, '')
}

function authHeaders() {
  const secret = String(process.env.XORO_PAY_SECRET_KEY || '').trim()
  const pub = String(process.env.XORO_PAY_PUBLIC_KEY || '').trim()
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (secret) {
    headers.Authorization = `Bearer ${secret}`
    headers['x-api-key'] = secret
  }
  if (pub) {
    headers['x-public-key'] = pub
  }
  return headers
}

async function callXoro(pathname) {
  const base = normalizeBaseUrl(process.env.XORO_PAY_BASE_URL)
  const response = await fetch(`${base}${pathname}`, {
    method: 'GET',
    headers: authHeaders(),
  })
  const text = await response.text()
  let payload = {}
  try {
    payload = text ? JSON.parse(text) : {}
  } catch {
    payload = { rawText: text }
  }

  return {
    ok: response.ok,
    status: response.status,
    payload,
  }
}

async function verifyByReference(reference) {
  const encoded = encodeURIComponent(reference)
  const paths = [
    `/api/v1/verify/${encoded}`,
    `/api/v1/verify?reference=${encoded}`,
    `/api/v1/transaction/verify/${encoded}`,
    `/payments/verify/${encoded}`,
    `/payments/verify?reference=${encoded}`,
  ]

  const attempts = []
  for (const p of paths) {
    try {
      const result = await callXoro(p)
      attempts.push({ path: p, ok: result.ok, status: result.status, payload: result.payload })
      if (result.ok) break
    } catch (error) {
      attempts.push({ path: p, error: String(error?.message || error) })
    }
  }

  return attempts
}

const WalletTransactionSchema = new mongoose.Schema({}, { strict: false, collection: 'wallettransactions' })
const WalletTransaction = mongoose.model('WalletTransactionInspectTopupVerify', WalletTransactionSchema)

async function run() {
  loadEnvLocal()

  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI missing')

  await mongoose.connect(process.env.MONGODB_URI)

  const tx = await WalletTransaction.findOne({ type: 'topup', status: 'pending' })
    .sort({ createdAt: -1 })
    .lean()

  if (!tx) {
    console.log('No pending topup found')
    return
  }

  const candidates = Array.from(new Set([
    tx.paymentReference,
    tx.reference,
    tx?.metadata?.orderId,
    tx?.metadata?.orderID,
    tx?.metadata?.paymentReference,
    tx?.metadata?.payment_reference,
  ].filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim())))

  console.log('Pending tx:')
  console.log(JSON.stringify({
    id: String(tx._id),
    reference: tx.reference,
    paymentReference: tx.paymentReference,
    amount: tx.amount,
    createdAt: tx.createdAt,
    candidates,
  }, null, 2))

  for (const ref of candidates) {
    const attempts = await verifyByReference(ref)
    console.log(`\nVerification attempts for: ${ref}`)
    console.log(JSON.stringify(attempts, null, 2))
  }
}

run()
  .catch((error) => {
    console.error(error.message || error)
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      await mongoose.disconnect()
    } catch {
      // ignore
    }
  })
