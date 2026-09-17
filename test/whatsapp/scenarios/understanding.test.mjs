// Brand misses, comparatives, "both", number words, local-language greetings, reorder.
import assert from 'node:assert/strict'
import { test, before, after, beforeEach } from 'node:test'
import { startDb, stopDb, wipeDb, loadBot, say, texts, seedVendor, seedProduct } from './harness.mjs'

before(async () => { await startDb(); await loadBot() })
after(stopDb)
beforeEach(async () => {
  await wipeDb()
  const { store } = await seedVendor()
  await seedProduct(store, { name: 'Red Sneakers', price: 15000, stock: 5 })
  await seedProduct(store, { name: 'Black Sneakers', price: 9000, stock: 5 })
  await seedProduct(store, { name: 'iPhone 13 Case', price: 4500, stock: 9, category: 'electronics' })
})

test('a brand or qualifier we do not stock falls back to what we do have', async () => {
  const nike = texts(await say('nike sneakers'))
  assert.match(nike, /don't have "nike sneakers" exactly/)
  assert.match(nike, /Sneakers/)
  const leather = texts(await say('black leather sneakers'))
  assert.match(leather, /here's what I have for "black sneakers"/)
  assert.match(leather, /Black Sneakers/)
})

test('"the cheaper one" / "the expensive one" pick by price; "which is better?" compares', async () => {
  await say('sneakers')
  assert.match(texts(await say('the cheaper one')), /Black Sneakers — NGN 9,000/)
  assert.match(texts(await say('add the expensive one')), /Added: Red Sneakers/)
  const compare = texts(await say('which one is better?'))
  assert.match(compare, /Side by side/)
  assert.match(compare, /Black Sneakers is the cheapest/)
})

test('"I\'ll take both" adds every card; "I want five" asks which one', async () => {
  await say('sneakers')
  const both = texts(await say("I'll take both"))
  assert.match(both, /Added: Black Sneakers x1/)
  assert.match(both, /Added: Red Sneakers x1/)
  assert.match(texts(await say('I want five')), /5 of which one\?/)
  await say('phone case')
  assert.match(texts(await say('I want five')), /Added: iPhone 13 Case x5/)
})

test('local-language greetings and "hello?" get the welcome', async () => {
  for (const msg of ['bawo', 'kedu', 'sannu', 'hello?', 'e kaaro']) {
    assert.match(texts(await say(msg)), /Tell me what you need/, msg)
  }
})

test('"do you sell phones?" and "wetin be the price of sneakers" search', async () => {
  assert.match(texts(await say('do you sell phones?')), /iPhone 13 Case/)
  assert.match(texts(await say('wetin be the price of sneakers')), /Sneakers/)
})

test('"reorder" with no history explains; cart phrasings show the cart', async () => {
  assert.match(texts(await say('reorder')), /haven't ordered/i)
  await say('sneakers')
  await say('1')
  assert.match(texts(await say('what did I add?')), /Your cart:/)
})
