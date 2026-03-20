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

    const equalsIdx = line.indexOf('=')
    if (equalsIdx < 0) continue

    const key = line.slice(0, equalsIdx).trim()
    let value = line.slice(equalsIdx + 1).trim()

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

const isSuccessLikeStatus = (status) => {
  const normalized = String(status || '').trim().toLowerCase()
  if (!normalized) return false
  return (
    ['success', 'successful', 'succeeded', 'completed', 'complete', 'paid', 'approved', 'ok', 'transferred', 'done', 'true'].includes(normalized)
    || normalized.includes('success')
    || normalized.includes('succeed')
    || normalized.includes('complete')
    || normalized.includes('paid')
    || normalized.includes('approve')
    || normalized.includes('transfer success')
  )
}

const pickTransferStatus = (tx) => {
  return String(
    tx?.metadata?.transferData?.status
    || tx?.metadata?.transferStatus
    || tx?.metadata?.xoroTransferRaw?.status
    || tx?.metadata?.xoroTransferRaw?.transfer_status
    || tx?.metadata?.xoroTransferRaw?.transferStatus
    || ''
  ).trim()
}

const WalletTransactionSchema = new mongoose.Schema({}, { strict: false, collection: 'wallettransactions' })
const WalletTransaction = mongoose.model('WalletTransactionBulkReconcile', WalletTransactionSchema)

const UserSchema = new mongoose.Schema({}, { strict: false, collection: 'users' })
const User = mongoose.model('UserBulkReconcile', UserSchema)

async function run() {
  loadEnvLocal()

  const mongoUri = process.env.MONGODB_URI
  if (!mongoUri) {
    throw new Error('MONGODB_URI is missing from environment/.env.local')
  }

  console.log('Connecting to MongoDB...')
  await mongoose.connect(mongoUri)
  console.log('Connected.\n')

  const summary = {
    topups: { pending: 0, completed: 0, credited: 0, skipped: 0 },
    withdrawals: { pending: 0, completed: 0, skippedNoSignal: 0 },
  }

  const pendingTopups = await WalletTransaction.find({
    type: 'topup',
    status: 'pending',
  }).sort({ createdAt: 1 }).lean()

  summary.topups.pending = pendingTopups.length
  console.log(`Pending top-ups: ${pendingTopups.length}`)

  for (const tx of pendingTopups) {
    const amount = Number(tx.amount || 0)
    if (!Number.isFinite(amount) || amount <= 0) {
      summary.topups.skipped += 1
      continue
    }

    const completeResult = await WalletTransaction.updateOne(
      { _id: tx._id, status: 'pending' },
      {
        $set: {
          status: 'completed',
          metadata: {
            ...(tx.metadata || {}),
            bulkReconcile: {
              source: 'reconcile-pending-transactions.js',
              action: 'force_complete_topup',
              at: new Date().toISOString(),
            },
          },
          updatedAt: new Date(),
        },
      }
    )

    if (completeResult.modifiedCount === 0) {
      summary.topups.skipped += 1
      continue
    }

    summary.topups.completed += 1

    const userIdRaw = String(tx.userId || '')
    const userId = mongoose.Types.ObjectId.isValid(userIdRaw) ? new mongoose.Types.ObjectId(userIdRaw) : tx.userId

    const creditResult = await User.updateOne(
      { _id: userId },
      {
        $inc: { walletBalance: amount },
        $set: { updatedAt: new Date() },
      }
    )

    if (creditResult.modifiedCount > 0) {
      summary.topups.credited += 1
    }
  }

  const pendingWithdrawals = await WalletTransaction.find({
    type: 'withdrawal',
    status: 'pending',
  }).sort({ createdAt: 1 }).lean()

  summary.withdrawals.pending = pendingWithdrawals.length
  console.log(`Pending withdrawals: ${pendingWithdrawals.length}`)

  for (const tx of pendingWithdrawals) {
    const transferStatus = pickTransferStatus(tx)

    if (!isSuccessLikeStatus(transferStatus)) {
      summary.withdrawals.skippedNoSignal += 1
      continue
    }

    const updateResult = await WalletTransaction.updateOne(
      { _id: tx._id, status: 'pending' },
      {
        $set: {
          status: 'completed',
          metadata: {
            ...(tx.metadata || {}),
            bulkReconcile: {
              source: 'reconcile-pending-transactions.js',
              action: 'complete_withdrawal_from_transfer_status',
              transferStatus,
              at: new Date().toISOString(),
            },
          },
          updatedAt: new Date(),
        },
      }
    )

    if (updateResult.modifiedCount > 0) {
      summary.withdrawals.completed += 1
    }
  }

  console.log('\nReconciliation summary:')
  console.log(JSON.stringify(summary, null, 2))
}

run()
  .catch((error) => {
    console.error('Reconciliation failed:', error.message || error)
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      await mongoose.disconnect()
    } catch {
      // ignore
    }
  })
