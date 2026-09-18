// Welcome buttons, an order awaiting payment, "I received it", and the support handoff.
import assert from 'node:assert/strict'
import path from 'node:path'
import { test, before, after, beforeEach } from 'node:test'
import { startDb, stopDb, wipeDb, loadBot, say, texts, last, seedVendor, seedProduct, BUYER } from './harness.mjs'
import { outbox } from './stub-client.mjs'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..')
const SUPPORT = '2348000000001'
let Order, WhatsAppBuyer, WhatsAppBrowseState, User
before(async () => {
  await startDb(); await loadBot()
  Order = (await import(path.join(ROOT, 'lib/models/Order.ts'))).Order
  WhatsAppBuyer = (await import(path.join(ROOT, 'lib/models/WhatsAppBuyer.ts'))).WhatsAppBuyer
  WhatsAppBrowseState = (await import(path.join(ROOT, 'lib/models/WhatsAppBrowseState.ts'))).WhatsAppBrowseState
  User = (await import(path.join(ROOT, 'lib/models/User.ts'))).User
})
after(stopDb)
beforeEach(async () => {
  delete process.env.SUPPORT_WHATSAPP_NUMBER
  await wipeDb()
  const { store } = await seedVendor()
  await seedProduct(store, { name: 'Red Sneakers', price: 15000, stock: 5 })
})

async function buyerWithOrder(overrides = {}) {
  const user = await User.create({ email: 'buyer@test.dev', name: 'David', role: 'customer' })
  await WhatsAppBuyer.create({ waId: BUYER, customerId: String(user._id) })
  const order = await Order.create({
    orderId: 'ORD-AB12CD34-XYZ', customerId: String(user._id), totalAmount: 15000, paymentStatus: 'escrow', status: 'delivered',
    items: [{ productId: 'p1', title: 'Red Sneakers', quantity: 1, price: 15000 }], vendors: [], ...overrides,
  })
  return { user, order }
}

test('a greeting sends tappable buttons whose taps route like commands', async () => {
  const replies = await say('hi')
  assert.equal(last(replies).kind, 'buttons')
  assert.equal(last(replies).buttons.length, 3)
  const { commands } = await loadBot()
  const start = outbox.length
  await commands.handleInboundMessage(BUYER, 'my orders')
  assert.match(texts(outbox.slice(start)), /haven't placed an order/i)
})

test('an unpaid order: "link" re-sends it, "I have paid" is checked, browsing still works', async () => {
  const { user } = await buyerWithOrder({ orderId: 'ORD-PAY1', paymentStatus: 'pending', status: 'pending_payment' })
  await WhatsAppBrowseState.create({ waId: BUYER, stage: 'awaiting_payment', pendingOrderId: 'ORD-PAY1', pendingPaymentUrl: 'https://paystack.test/pay/abc', pendingPaymentTotal: 15000, cart: [{ productId: 'p1', title: 'Red Sneakers', quantity: 1, price: 15000 }] })
  assert.match(texts(await say('send the link again')), /paystack\.test\/pay\/abc/)
  assert.match(texts(await say("I've paid")), /can't see the payment .* yet/i)
  assert.match(texts(await say('sneakers')), /Red Sneakers/) // not blocked
  assert.match(texts(await say('checkout')), /still have an unpaid order ORD-PAY1/)
  await Order.updateOne({ orderId: 'ORD-PAY1' }, { $set: { paymentStatus: 'paid' } })
  assert.match(texts(await say('I have paid')), /Payment received — order ORD-PAY1 is confirmed/)
  const state = await WhatsAppBrowseState.findOne({ waId: BUYER }).lean()
  assert.equal(state.stage, 'browsing')
  assert.equal(String(user._id).length > 0, true)
})

test('"I received my order" marks the delivered escrow order received', async () => {
  await buyerWithOrder()
  const body = texts(await say('I have received my order'))
  assert.match(body, /ORD-AB12 is marked as received/)
  const order = await Order.findOne({ orderId: 'ORD-AB12CD34-XYZ' }).lean()
  assert.equal(order.status, 'received')
  assert.ok(order.receivedAt)
  assert.match(texts(await say('received')), /already marked as received/)
})

test('with several deliveries "received" asks which, and a disputed order is refused', async () => {
  const { user } = await buyerWithOrder()
  await Order.create({ orderId: 'ORD-EF56GH78-XYZ', customerId: String(user._id), totalAmount: 9000, paymentStatus: 'escrow', status: 'shipped', items: [{ productId: 'p2', title: 'Black Sneakers', quantity: 2, price: 4500 }], vendors: [], disputeStatus: 'active' })
  const ask = texts(await say('got it'))
  assert.match(ask, /Which order did you receive\?/)
  assert.match(texts(await say('received ORD-EF56')), /open dispute/)
  assert.match(texts(await say('received ORD-AB12')), /marked as received/)
})

test('human handoff relays both ways and "bot" returns control', async () => {
  process.env.SUPPORT_WHATSAPP_NUMBER = SUPPORT
  const { commands } = await loadBot()
  const replies = await say('I want to talk to a human')
  const toBuyer = replies.find((m) => m.to === BUYER)
  const toSupport = replies.find((m) => m.to === SUPPORT)
  assert.match(toBuyer.body, /passed this to our support team/)
  assert.match(toSupport.body, new RegExp(`r ${BUYER} <your message>`))

  // Buyer keeps talking: forwarded, bot silent.
  const forwarded = await say('my package is torn')
  assert.equal(forwarded.length, 1)
  assert.equal(forwarded[0].to, SUPPORT)
  assert.match(forwarded[0].body, /my package is torn/)

  // Support replies through the bot.
  let start = outbox.length
  await commands.handleInboundMessage(SUPPORT, `r ${BUYER} Sorry about that — we'll send a replacement.`)
  const relayed = outbox.slice(start)
  assert.ok(relayed.some((m) => m.to === BUYER && /replacement/.test(m.body)))

  // Support hands back.
  start = outbox.length
  await commands.handleInboundMessage(SUPPORT, `bot ${BUYER}`)
  assert.ok(outbox.slice(start).some((m) => m.to === BUYER && /handed you back/.test(m.body)))
  assert.match(texts(await say('sneakers')), /Red Sneakers/)
})

test('without a support number, "talk to a human" still gives the email', async () => {
  assert.match(texts(await say('talk to a human')), /support@makeitsell\.ng/)
})
