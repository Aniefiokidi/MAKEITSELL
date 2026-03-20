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

const WalletTransactionSchema = new mongoose.Schema({}, { strict: false, collection: 'wallettransactions' })
const WalletTransaction = mongoose.model('WalletTransactionInspectPending', WalletTransactionSchema)

async function run() {
  loadEnvLocal()
  const mongoUri = process.env.MONGODB_URI
  if (!mongoUri) throw new Error('MONGODB_URI missing')

  await mongoose.connect(mongoUri)

  const rows = await WalletTransaction.find({
    type: 'withdrawal',
    status: 'pending',
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean()

  const output = rows.map((tx) => ({
    id: String(tx._id),
    reference: tx.reference,
    userId: tx.userId,
    amount: tx.amount,
    provider: tx.provider,
    createdAt: tx.createdAt,
    transferStatus: tx?.metadata?.transferStatus,
    transferDataStatus: tx?.metadata?.transferData?.status,
    xoroTransferRawStatus: tx?.metadata?.xoroTransferRaw?.status,
    payoutReference: tx?.metadata?.payoutReference,
    transferCode: tx?.metadata?.transferCode,
  }))

  console.log(JSON.stringify(output, null, 2))
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
