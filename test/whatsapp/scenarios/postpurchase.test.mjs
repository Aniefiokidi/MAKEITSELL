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

test('an agent can find, add and check out for a handed-off buyer while the bot executes actions', async () => {
  process.env.SUPPORT_WHATSAPP_NUMBER = SUPPORT
  const { commands } = await loadBot()
  const { store } = await seedVendor({ storeName: 'Shoe Hub', phone: '+2348011110050' })
  await seedProduct(store, { name: 'Black Sneakers', price: 9000, stock: 5 })
  await say('I want to talk to a human')

  // Agent searches on the buyer's behalf: buyer gets cards, agent gets a summary.
  let start = outbox.length
  await commands.handleInboundMessage(SUPPORT, `find ${BUYER} sneakers`)
  let sent = outbox.slice(start)
  assert.ok(sent.some((m) => m.to === BUYER && /1\. .*Sneakers/.test(m.body)))
  assert.ok(sent.some((m) => m.to === SUPPORT && /Sent to .*\n1\. /.test(m.body)))

  // Buyer picks a card: the bot executes it and the agent gets a copy.
  const pick = await say('2')
  assert.ok(pick.some((m) => m.to === BUYER && /Added: .*Sneakers x1/.test(m.body)))
  assert.ok(pick.some((m) => m.to === SUPPORT && /handled by bot/.test(m.body)))

  // But a question still goes to the agent only.
  const question = await say('is it original?')
  assert.equal(question.length, 1)
  assert.equal(question[0].to, SUPPORT)

  // Agent adds another and views the cart.
  start = outbox.length
  await commands.handleInboundMessage(SUPPORT, `add ${BUYER} 1 x2`)
  assert.match(texts(outbox.slice(start).filter((m) => m.to === SUPPORT)), /Added .*Sneakers to .*\n\n1\. /)
  start = outbox.length
  await commands.handleInboundMessage(SUPPORT, `cart ${BUYER}`)
  assert.match(texts(outbox.slice(start)), /Subtotal: NGN/)

  // Agent starts checkout; the buyer's name reply is handled by the bot.
  start = outbox.length
  await commands.handleInboundMessage(SUPPORT, `checkout ${BUYER}`)
  assert.ok(outbox.slice(start).some((m) => m.to === BUYER && /What's your name/.test(m.body)))
  const named = await say('David Okafor')
  assert.ok(named.some((m) => m.to === BUYER && /address/i.test(m.body)))

  // Service search and link.
  start = outbox.length
  await commands.handleInboundMessage(SUPPORT, `link ${BUYER} sneakers`)
  assert.ok(outbox.slice(start).some((m) => m.to === BUYER && /\/search\?q=sneakers/.test(m.body)))
  start = outbox.length
  await commands.handleInboundMessage(SUPPORT, 'help')
  assert.match(texts(outbox.slice(start)), /find NUMBER/)
})

test('a returning buyer is welcomed by name with reorder and last-search buttons', async () => {
  const { user } = await buyerWithOrder({ orderId: 'ORD-LAST1', status: 'received', items: [{ productId: 'p1', title: 'Red Sneakers', quantity: 1, price: 15000 }] })
  await say('sneakers size 42')
  await WhatsAppBuyer.updateOne({ waId: BUYER }, { $set: { lastActiveAt: new Date(Date.now() - 24 * 3600 * 1000) } })
  const welcome = last(await say('hi'))
  assert.equal(welcome.kind, 'buttons')
  assert.match(welcome.body, /Welcome back, David!/)
  assert.match(welcome.body, /Last time you ordered Red Sneakers/)
  assert.match(welcome.body, /looking at "sneakers"/)
  assert.ok(welcome.buttons.some((b) => b.id === 'cmd:reorder'))
  const mapping = await WhatsAppBuyer.findOne({ waId: BUYER }).lean()
  assert.equal(mapping.preferredSize, '42')
  assert.equal(String(user._id).length > 0, true)
})

test('a remembered size is suggested when a product asks for one', async () => {
  const { store } = await seedVendor({ storeName: 'Boot Barn', phone: '+2348011110077' })
  await seedProduct(store, { name: 'Leather Boots', price: 42000, stock: 4, variants: [{ label: 'Size', value: '42', stock: 2 }, { label: 'Size', value: '43', stock: 2 }] })
  await buyerWithOrder({ orderId: 'ORD-SZ1' })
  await say('sneakers size 42')
  await say('boots')
  const prompt = texts(await say('1'))
  assert.match(prompt, /You took 42 last time/)
})

test('a review prompt is sent 2 days after receipt and a rating + comment becomes a review', async () => {
  const { user } = await buyerWithOrder({ orderId: 'ORD-REV1', status: 'received', receivedAt: new Date(Date.now() - 3 * 86400000), items: [{ productId: 'p1', title: 'Red Sneakers', quantity: 1, price: 15000 }], vendors: [{ vendorId: 'v1', storeId: 's1', items: [] }] })
  const proactive = await import(path.join(ROOT, 'lib/whatsapp/proactive.ts'))
  const Review = (await import(path.join(ROOT, 'lib/models/Review.ts'))).Review
  const start = outbox.length
  const result = await proactive.sendReviewPrompts()
  assert.equal(result.sent, 1)
  assert.match(texts(outbox.slice(start)), /buyer_review_prompt\] Red Sneakers/)
  assert.match(texts(await say('5')), /Great to hear/)
  assert.match(texts(await say('Perfect fit, fast delivery')), /5-star review .* is posted/)
  const review = await Review.findOne({ orderId: 'ORD-REV1' }).lean()
  assert.equal(review.rating, 5)
  assert.equal(review.comment, 'Perfect fit, fast delivery')
  assert.equal(review.customerId, String(user._id))
  // Not asked twice.
  assert.equal((await proactive.sendReviewPrompts()).sent, 0)
})

test('an unrelated message during a review prompt is handled normally', async () => {
  await buyerWithOrder({ orderId: 'ORD-REV2', status: 'received', receivedAt: new Date(Date.now() - 3 * 86400000) })
  const proactive = await import(path.join(ROOT, 'lib/whatsapp/proactive.ts'))
  await proactive.sendReviewPrompts()
  assert.match(texts(await say('sneakers')), /1\. Red Sneakers/)
  assert.match(texts(await say('4')), /Thanks — noted|Great to hear/)
})

test('asking for an out-of-stock item registers a watch and the alert fires when it returns', async () => {
  const { store } = await seedVendor({ storeName: 'Bag World', phone: '+2348011110088' })
  const Product = (await import(path.join(ROOT, 'lib/models/Product.ts'))).Product
  const bag = await seedProduct(store, { name: 'Tote Bag', price: 12000, stock: 1 })
  await say('tote bag')
  await Product.updateOne({ _id: bag._id }, { $set: { stock: 0 } })
  assert.match(texts(await say('1')), /out of stock right now — I'll message you/)
  const proactive = await import(path.join(ROOT, 'lib/whatsapp/proactive.ts'))
  assert.equal((await proactive.sendBackInStockAlerts()).sent, 0)
  await Product.updateOne({ _id: bag._id }, { $set: { stock: 5 } })
  const start = outbox.length
  assert.equal((await proactive.sendBackInStockAlerts()).sent, 1)
  assert.match(texts(outbox.slice(start)), /buyer_back_in_stock\] Tote Bag \| NGN 12,000/)
  assert.match(texts(await say('add')), /Added: Tote Bag x1/)
})
