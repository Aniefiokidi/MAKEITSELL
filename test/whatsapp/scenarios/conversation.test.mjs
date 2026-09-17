// The messages a human shop assistant handles without blinking and a keyword bot gets
// wrong: FAQ questions, acknowledgements, context-less actions, vague requests, and
// service requests phrased around the person ("who can fix my generator?").
import assert from 'node:assert/strict'
import { test, before, after, beforeEach } from 'node:test'
import { startDb, stopDb, wipeDb, loadBot, say, texts, last, seedVendor, seedProduct, seedService } from './harness.mjs'

before(async () => { await startDb(); await loadBot() })
after(stopDb)
beforeEach(async () => {
  await wipeDb()
  const { store } = await seedVendor()
  await seedProduct(store, { name: 'Red Sneakers', price: 15000, stock: 5 })
  await seedProduct(store, { name: 'iPhone 13 Case', price: 4500, stock: 9, category: 'electronics' })
  const fixit = await seedVendor({ storeName: 'FixIt Yaba', phone: '+2348011110006', city: 'Yaba', state: 'Lagos' })
  await seedService(fixit.store, { title: 'Generator Repair', price: 10000, category: 'repairs', description: 'Generator and inverter servicing', pricingType: 'per-session' })
})

const NOT_FOUND = /couldn't find a close match|couldn't match/i

test('delivery, payment, returns and support questions get real answers', async () => {
  assert.match(texts(await say('do you deliver to Abuja?')), /deliver nationwide/i)
  assert.match(texts(await say('how do I pay?')), /payment link|escrow/i)
  assert.match(texts(await say("what's your return policy?")), /5 days|refund/i)
  assert.match(texts(await say('I want to talk to a human')), /support@makeitsell\.ng/)
  assert.match(texts(await say('is pay on delivery available?')), /don't do pay-on-delivery/i)
})

test('acknowledgements are not searched', async () => {
  for (const ack of ['ok', 'okay', 'alright', 'noted', '👍']) {
    const body = texts(await say(ack))
    assert.doesNotMatch(body, NOT_FOUND, `${ack}: ${body}`)
  }
})

test('"add", a bare number or "how much be this?" without a card asks which item', async () => {
  assert.match(texts(await say('add')), /which item/i)
  assert.match(texts(await say('2')), /which item/i)
  assert.match(texts(await say('how much be this?')), /which item/i)
})

test('"what do you sell?" and Pidgin "wetin una get?" open the category menu', async () => {
  assert.equal(last(await say('what do you sell?')).kind, 'list')
  assert.equal(last(await say('wetin una get?')).kind, 'list')
})

test('a vague request is met with a clarifying question, not a shrug', async () => {
  const body = texts(await say("I'm looking for a gift for my wife"))
  assert.match(body, /specific item|tell me/i)
  assert.doesNotMatch(body, /close match/i)
})

test('a size in the request does not break the search', async () => {
  assert.match(texts(await say('sneakers size 42')), /Red Sneakers/)
  assert.match(texts(await say('red sneakers UK 8')), /Red Sneakers/)
})

test('a service phrased around the person or problem is recognised as a service', async () => {
  const ask = texts(await say('who can fix my generator?'))
  assert.match(ask, /where are you/i)
  assert.match(ask, /"generator"/)
  const body = texts(await say('surulere'))
  assert.match(body, /FixIt Yaba/)
  assert.match(body, /2348011110006|0801 111 0006/)
  assert.match(body, /10,000 per session/)
  assert.match(body, /nearby|km away/)
})

test('"someone to fix my generator in Yaba" is a service request, not a support request', async () => {
  const body = texts(await say('I need someone to fix my generator in Yaba'))
  assert.match(body, /FixIt Yaba/)
  assert.doesNotMatch(body, /support@/)
})

test('a bare place name with nothing pending is remembered, not searched', async () => {
  const body = texts(await say('Lagos'))
  assert.match(body, /Got it — Lagos/)
  const next = texts(await say('generator repair'))
  assert.match(next, /FixIt Yaba/)
  assert.doesNotMatch(next, /where are you/i)
})

test('a service with no listed providers says so without pretending it is a product', async () => {
  const body = texts(await say('I need a cleaner'))
  assert.match(body, /among products or services/i)
})
