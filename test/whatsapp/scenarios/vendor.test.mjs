// A linked vendor talking to the bot in plain words.
import assert from 'node:assert/strict'
import path from 'node:path'
import { test, before, after, beforeEach } from 'node:test'
import { startDb, stopDb, wipeDb, loadBot, texts, seedVendor } from './harness.mjs'
import { outbox } from './stub-client.mjs'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..')
const VENDOR_WA = '2348055550001'
let WhatsAppLink, Order, User, commands, vendor, store
before(async () => {
  await startDb(); ({ commands } = await loadBot())
  WhatsAppLink = (await import(path.join(ROOT, 'lib/models/WhatsAppLink.ts'))).WhatsAppLink
  Order = (await import(path.join(ROOT, 'lib/models/Order.ts'))).Order
  User = (await import(path.join(ROOT, 'lib/models/User.ts'))).User
})
after(stopDb)
beforeEach(async () => {
  await wipeDb()
  ;({ vendor, store } = await seedVendor())
  await User.updateOne({ _id: vendor._id }, { $set: { walletBalance: 25000, earnedBalance: 25000 } })
  await WhatsAppLink.create({ vendorId: String(vendor._id), waId: VENDOR_WA, status: 'linked', linkedAt: new Date() })
})

async function vendorSays(text) {
  const start = outbox.length
  await commands.handleInboundMessage(VENDOR_WA, text)
  return texts(outbox.slice(start))
}

async function pendingOrder(orderId, title, status = 'confirmed') {
  return Order.create({
    orderId, customerId: 'cust1', totalAmount: 15000, paymentStatus: 'escrow', status,
    shippingInfo: { city: 'Ikeja', state: 'Lagos' },
    vendors: [{ vendorId: String(vendor._id), storeId: String(store._id), status, total: 15000, items: [{ title, quantity: 1, price: 15000 }] }],
    items: [],
  })
}

test('plain-language balance and sales questions', async () => {
  assert.match(await vendorSays("what's my balance?"), /Wallet Balance/)
  assert.match(await vendorSays('how much did I make this week'), /This Week's Sales/)
  assert.match(await vendorSays('how much did I make today'), /Today's Sales/)
})

test('"orders" lists what is waiting to ship and "dispatched 1" ships it', async () => {
  await pendingOrder('ORD-AAAA1111-X', 'Red Sneakers')
  await pendingOrder('ORD-BBBB2222-Y', 'Gold Bracelet')
  await pendingOrder('ORD-CCCC3333-Z', 'Old Order', 'shipped')
  const list = await vendorSays('what do I need to ship?')
  assert.match(list, /1\. ORD-BBBB — 1x Gold Bracelet → Ikeja, Lagos/)
  assert.match(list, /2\. ORD-AAAA — 1x Red Sneakers/)
  assert.doesNotMatch(list, /Old Order/)
  const shipped = await vendorSays('dispatched 2')
  assert.match(shipped, /ORD-AAAA/i)
  const order = await Order.findOne({ orderId: 'ORD-AAAA1111-X' }).lean()
  assert.equal(order.vendors[0].status, 'shipped')
  assert.match(await vendorSays('I have shipped order ORD-BBBB'), /ORD-BBBB/)
  assert.match(await vendorSays('orders'), /Nothing waiting to ship/)
})

test('a vendor greeting gets a short menu instead of "didn\'t recognize"', async () => {
  const body = await vendorSays('good morning')
  assert.match(body, /"orders"/)
  assert.doesNotMatch(body, /didn't recognize/)
})
