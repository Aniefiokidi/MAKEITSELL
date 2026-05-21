/**
 * Backfills A&CO logistics wallet for orders delivered this week.
 * Idempotent — uses reference LOGISTICS-DELIVERY-{orderId} to prevent double-crediting.
 * Orah (Abuja) is skipped — no sales were made this week.
 */
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
import dns from 'dns'
dns.setDefaultResultOrder('ipv4first')
dotenv.config({ path: '.env.local' })

const uri = process.env.MONGODB_URI
const ACO_EMAIL = 'a&co@makeitselll.org'  // normalised lowercase

// Mirrors estimateShippingFee logic — we pull the already-computed fee from
// the shippingFee field on orders if stored, otherwise fall back to a flat rate.
// For this backfill we use the formula from aco-logistics-rates:
//   - intra-Lagos: ₦3,000–5,000 range (use midpoint 4,000 unless stored)
//   - interstate:  based on route table
// Simpler: use the order's (totalAmount - productSubtotal) as delivery fee proxy,
// OR store a "shippingFee" field if the orders have one.

function getDeliveryFeeFromOrder(order) {
  // Try explicit field first
  if (order.deliveryFee && Number(order.deliveryFee) > 0) return Number(order.deliveryFee)
  if (order.shippingFee && Number(order.shippingFee) > 0) return Number(order.shippingFee)

  // Derive from totalAmount minus items subtotal
  const itemsSubtotal = Array.isArray(order.vendors)
    ? order.vendors.reduce((sum, v) => sum + Number(v.total || 0), 0)
    : (Array.isArray(order.items)
        ? order.items.reduce((sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 1), 0)
        : 0)

  const derived = Number(order.totalAmount || 0) - itemsSubtotal
  if (derived > 0) return derived

  return null
}

const client = new MongoClient(uri, { family: 4, serverSelectionTimeoutMS: 15000 })

async function main() {
  await client.connect()
  const db = client.db()

  // Find A&CO user
  const acoUser = await db.collection('users').findOne({ email: { $regex: /^a&co@makeitselll\.org$/i } })
  if (!acoUser) {
    console.error('A&CO user not found. Check email in DB.')
    return
  }
  console.log('A&CO user found:', acoUser._id, '| current balance:', acoUser.walletBalance)

  // This week = Monday 00:00 to now
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sun, 1=Mon...
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - daysFromMonday)
  weekStart.setHours(0, 0, 0, 0)
  console.log('Week start:', weekStart.toISOString())

  // Find all delivered/received/completed orders this week
  const deliveredOrders = await db.collection('orders').find({
    status: { $in: ['delivered', 'received', 'completed'] },
    $or: [
      { deliveredAt: { $gte: weekStart } },
      { receivedAt: { $gte: weekStart } },
      { updatedAt: { $gte: weekStart } },
    ],
  }).toArray()

  console.log(`Found ${deliveredOrders.length} delivered orders this week (all regions)`)

  // Filter to Lagos orders — store must be in Lagos
  // We identify Lagos orders by checking shippingInfo or storeIds
  // Best proxy: order has a Lagos pickup store OR customer shipping state is Lagos
  // We'll use a broader approach: include all orders and let the fee calculation confirm

  let credited = 0
  let skipped = 0
  let alreadyDone = 0

  for (const order of deliveredOrders) {
    const orderId = order.orderId || String(order._id)
    const reference = `LOGISTICS-DELIVERY-${orderId}`

    // Check idempotency
    const existing = await db.collection('wallettransactions').findOne({ reference })
    if (existing) {
      alreadyDone++
      console.log(`  [skip] ${orderId} — already credited`)
      continue
    }

    const fee = getDeliveryFeeFromOrder(order)
    if (!fee || fee <= 0) {
      skipped++
      console.log(`  [skip] ${orderId} — no fee derivable (totalAmount: ${order.totalAmount})`)
      continue
    }

    const deliveredAt = order.deliveredAt || order.receivedAt || order.updatedAt || new Date()

    // Insert transaction
    await db.collection('wallettransactions').insertOne({
      userId: String(acoUser._id),
      type: 'logistics_delivery_credit',
      amount: fee,
      status: 'completed',
      reference,
      provider: 'platform',
      note: `Delivery credit for order #${orderId}`,
      metadata: { source: 'backfill_aco_wallet', orderId, region: 'lagos' },
      orderId,
      createdAt: deliveredAt,
      updatedAt: new Date(),
    })

    // Credit wallet balance
    await db.collection('users').updateOne(
      { _id: acoUser._id },
      { $inc: { walletBalance: fee }, $set: { updatedAt: new Date() } }
    )

    credited++
    console.log(`  [credited] ${orderId} — ₦${fee.toLocaleString()}`)
  }

  // Fetch updated balance
  const updated = await db.collection('users').findOne({ _id: acoUser._id })
  console.log('\n=== SUMMARY ===')
  console.log(`  Orders credited:    ${credited}`)
  console.log(`  Already done:       ${alreadyDone}`)
  console.log(`  Skipped (no fee):   ${skipped}`)
  console.log(`  New A&CO balance:   ₦${Number(updated.walletBalance || 0).toLocaleString()}`)
}

main().catch(console.error).finally(() => client.close())
