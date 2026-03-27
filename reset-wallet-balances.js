const dns = require('dns')
const mongoose = require('mongoose')

dns.setServers(['8.8.8.8', '1.1.1.1'])

const MONGODB_URI = process.env.MONGODB_URI
const TARGET_NAME = 'Arnold Idiong'
const TARGET_BALANCE = 40000
const TARGET_EMAIL = String(process.env.TARGET_EMAIL || '').trim().toLowerCase()

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set. Export it before running this script.')
  process.exit(1)
}

const UserSchema = new mongoose.Schema({}, { strict: false, collection: 'users' })
const StoreSchema = new mongoose.Schema({}, { strict: false, collection: 'stores' })

const User = mongoose.models.User || mongoose.model('User', UserSchema)
const Store = mongoose.models.Store || mongoose.model('Store', StoreSchema)

const normalize = (value) => String(value || '').trim().toLowerCase()

async function findArnoldUser() {
  if (TARGET_EMAIL) {
    const byEmail = await User.findOne({ email: new RegExp(`^${TARGET_EMAIL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })
      .select('_id email name displayName role walletBalance')
      .lean()

    if (!byEmail) {
      console.error(`No user found for TARGET_EMAIL=${TARGET_EMAIL}. Aborting.`)
      process.exit(1)
    }

    return byEmail
  }

  const exactCandidates = await User.find({
    $or: [
      { name: /^arnold idiong$/i },
      { displayName: /^arnold idiong$/i },
    ],
  })
    .select('_id email name displayName role walletBalance')
    .lean()

  if (exactCandidates.length === 1) return exactCandidates[0]

  const broadCandidates = await User.find({
    $or: [
      { name: /arnold\s+idiong/i },
      { displayName: /arnold\s+idiong/i },
      { email: /arnold/i },
    ],
  })
    .select('_id email name displayName role walletBalance')
    .lean()

  const exactByNormalized = broadCandidates.filter((candidate) => {
    return normalize(candidate.name) === normalize(TARGET_NAME) || normalize(candidate.displayName) === normalize(TARGET_NAME)
  })

  if (exactByNormalized.length === 1) return exactByNormalized[0]

  if (exactCandidates.length > 1 || exactByNormalized.length > 1) {
    console.error('Multiple exact Arnold Idiong matches found. Aborting to avoid assigning wrong wallet:')
    ;(exactCandidates.length > 1 ? exactCandidates : exactByNormalized).forEach((user) => {
      console.error(`- id=${user._id} email=${user.email || 'n/a'} name=${user.name || 'n/a'} displayName=${user.displayName || 'n/a'}`)
    })
    process.exit(1)
  }

  if (broadCandidates.length === 1) return broadCandidates[0]

  if (broadCandidates.length > 1) {
    console.error('Multiple broad Arnold candidates found. Aborting to avoid assigning wrong wallet:')
    broadCandidates.forEach((user) => {
      console.error(`- id=${user._id} email=${user.email || 'n/a'} name=${user.name || 'n/a'} displayName=${user.displayName || 'n/a'}`)
    })
    process.exit(1)
  }

  console.error('No user found for Arnold Idiong. Aborting.')
  process.exit(1)
}

async function main() {
  try {
    console.log('Connecting to MongoDB...')
    await mongoose.connect(MONGODB_URI)
    console.log('Connected.')

    const arnold = await findArnoldUser()
    console.log(`Target user: id=${arnold._id} email=${arnold.email || 'n/a'} name=${arnold.name || arnold.displayName || 'n/a'}`)

    const now = new Date()

    const usersReset = await User.updateMany(
      {},
      {
        $set: {
          walletBalance: 0,
          updatedAt: now,
        },
      }
    )

    const storesReset = await Store.updateMany(
      {},
      {
        $set: {
          walletBalance: 0,
          updatedAt: now,
        },
      }
    )

    const arnoldSet = await User.updateOne(
      { _id: arnold._id },
      {
        $set: {
          walletBalance: TARGET_BALANCE,
          updatedAt: now,
        },
      }
    )

    const nonZeroUsers = await User.find({ walletBalance: { $ne: 0 } })
      .select('_id email name displayName walletBalance')
      .lean()

    const nonZeroStoresCount = await Store.countDocuments({ walletBalance: { $ne: 0 } })

    console.log('\n=== Wallet Reset Summary ===')
    console.log(`Users reset to 0: ${usersReset.modifiedCount}`)
    console.log(`Stores reset to 0: ${storesReset.modifiedCount}`)
    console.log(`Arnold set to ${TARGET_BALANCE.toLocaleString('en-NG')}: ${arnoldSet.modifiedCount > 0 ? 'yes' : 'no'}`)

    console.log(`\nNon-zero users after reset: ${nonZeroUsers.length}`)
    nonZeroUsers.forEach((user) => {
      console.log(`- id=${user._id} email=${user.email || 'n/a'} name=${user.name || user.displayName || 'n/a'} balance=₦${Number(user.walletBalance || 0).toLocaleString('en-NG')}`)
    })

    console.log(`Non-zero stores after reset: ${nonZeroStoresCount}`)

    if (nonZeroUsers.length === 1 && normalize(nonZeroUsers[0].name || nonZeroUsers[0].displayName) === normalize(TARGET_NAME) && Number(nonZeroUsers[0].walletBalance) === TARGET_BALANCE && nonZeroStoresCount === 0) {
      console.log('\nSuccess: all wallets are zero except Arnold Idiong at ₦40,000.')
    } else {
      console.log('\nWarning: post-check does not exactly match expected final state. Review output above.')
    }
  } catch (error) {
    console.error('Failed to reset wallet balances:', error)
    process.exitCode = 1
  } finally {
    await mongoose.connection.close().catch(() => {})
  }
}

main()
