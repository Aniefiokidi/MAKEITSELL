// Follow-ups after provider cards, cart edits in plain words, checkout synonyms, order
// problems, farewells.
import assert from 'node:assert/strict'
import { test, before, after, beforeEach } from 'node:test'
import { startDb, stopDb, wipeDb, loadBot, say, texts, seedVendor, seedProduct, seedService } from './harness.mjs'

before(async () => { await startDb(); await loadBot() })
after(stopDb)
beforeEach(async () => {
  await wipeDb()
  const { store } = await seedVendor()
  await seedProduct(store, { name: 'Red Sneakers', price: 15000, stock: 5 })
  await seedProduct(store, { name: 'Gold Bracelet', price: 22000, stock: 3, category: 'jewelry' })
  const a = await seedVendor({ storeName: 'FixIt Yaba', phone: '+2348011110006', city: 'Yaba', state: 'Lagos' })
  await seedService(a.store, { title: 'Plumbing', price: 6000, category: 'repairs' })
  const b = await seedVendor({ storeName: 'Lekki Pipes', phone: '+2348011110007', city: 'Lekki', state: 'Lagos' })
  await seedService(b.store, { title: 'Plumber on call', price: 4000, category: 'repairs', description: 'Emergency plumbing' })
})

test('provider cards are numbered and "1", "the first one", "book the first one" re-send that provider', async () => {
  const cards = texts(await say('plumber in yaba'))
  assert.match(cards, /1\. Plumbing/)
  assert.match(cards, /2\. Plumber on call/)
  for (const msg of ['1', 'the first one', 'book the first one']) {
    const body = texts(await say(msg))
    assert.match(body, /details again/i, msg)
    assert.match(body, /2348011110006/, msg)
  }
  assert.match(texts(await say('2')), /2348011110007/)
})

test('"send me their number" with several providers asks which; with one it re-sends', async () => {
  await say('plumber in yaba')
  assert.match(texts(await say('send me their number')), /Which provider\?/)
  await say('emergency')
  assert.match(texts(await say('send me their number')), /2348011110007/)
})

test('"any cheaper?" re-sorts providers by rate', async () => {
  await say('plumber in yaba')
  const body = texts(await say('any cheaper?'))
  assert.match(body, /Lowest-rate/)
  assert.ok(body.indexOf('Plumber on call') < body.indexOf('Plumbing\n'), body)
})

test('cart edits in plain words: remove it, make it 3, clear cart, my total', async () => {
  await say('sneakers')
  await say('1')
  assert.match(texts(await say('change quantity to 3')), /Updated: Red Sneakers x3/)
  assert.match(texts(await say('I want 2 instead')), /Updated: Red Sneakers x2/)
  assert.match(texts(await say('how much is my total?')), /Subtotal: NGN 30,000/)
  await say('bracelet')
  await say('1')
  assert.match(texts(await say('remove the bracelet')), /Removed: Gold Bracelet/)
  assert.match(texts(await say('actually remove it')), /Removed: Red Sneakers/)
  await say('sneakers')
  await say('1')
  assert.match(texts(await say('clear cart')), /cart is empty/i)
})

test('checkout synonyms start checkout', async () => {
  for (const msg of ['proceed', 'pay now', 'buy now', "I'm done", 'place my order']) {
    await wipeDb()
    const { store } = await seedVendor()
    await seedProduct(store, { name: 'Red Sneakers', price: 15000, stock: 5 })
    await say('sneakers')
    await say('1')
    assert.match(texts(await say(msg)), /What's your name/, msg)
  }
})

test('order problems, farewells and opening hours', async () => {
  assert.match(texts(await say('cancel my order')), /orders/)
  assert.match(texts(await say("I haven't received my order")), /escrow|orders/)
  assert.match(texts(await say('thank you, bye')), /Bye for now/)
  assert.match(texts(await say('are you open now?')), /24\/7/)
})
