// ONE-TIME MIGRATION SCRIPT — Run once after deploying the three-balance wallet system.
// Sets earnedBalance = walletBalance for all existing vendors who have a real wallet
// balance but zero earnedBalance. Safe to re-run — only affects vendors where
// earnedBalance is still 0 and walletBalance is greater than 0.
// Run with: node scripts/backfill-earned-balance.mjs

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env.local') })

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL
if (!MONGODB_URI) {
  console.error('ERROR: No MONGODB_URI or DATABASE_URL found in .env.local')
  process.exit(1)
}

await mongoose.connect(MONGODB_URI)
console.log('Connected to MongoDB')

const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }))

const targets = await User.find({
  role: 'vendor',
  walletBalance: { $gt: 0 },
  $or: [
    { earnedBalance: { $exists: false } },
    { earnedBalance: 0 },
  ],
}).lean()

console.log(`Found ${targets.length} vendor(s) to backfill`)

if (targets.length === 0) {
  console.log('Nothing to do — all vendors already have earnedBalance set.')
  await mongoose.disconnect()
  process.exit(0)
}

let updated = 0
let failed = 0
let totalBackfilled = 0

for (const vendor of targets) {
  const id = vendor._id
  const wallet = Number(vendor.walletBalance || 0)
  try {
    const result = await User.updateOne(
      {
        _id: id,
        role: 'vendor',
        walletBalance: { $gt: 0 },
        $or: [
          { earnedBalance: { $exists: false } },
          { earnedBalance: 0 },
        ],
      },
      { $set: { earnedBalance: wallet, updatedAt: new Date() } }
    )
    if (result.modifiedCount === 1) {
      console.log(`  ✓ Vendor ${id} — walletBalance: ${wallet}, earnedBalance set to: ${wallet}`)
      updated++
      totalBackfilled += wallet
    } else {
      console.log(`  – Vendor ${id} — skipped (already updated or condition no longer met)`)
    }
  } catch (err) {
    console.error(`  ✗ Vendor ${id} — FAILED:`, err.message)
    failed++
  }
}

console.log('')
console.log('═══════════════════════════════════════════')
console.log(`Vendors updated:         ${updated}`)
console.log(`Vendors failed:          ${failed}`)
console.log(`Total earnedBalance set: ₦${totalBackfilled.toLocaleString('en-NG')}`)
console.log('═══════════════════════════════════════════')

if (failed > 0) {
  console.warn('WARNING: Some updates failed — review the errors above before marking migration complete.')
} else {
  console.log('Backfill complete.')
}

await mongoose.disconnect()
