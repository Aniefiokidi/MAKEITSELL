// Referring to the cards on screen the way a person would — by number, ordinal, colour,
// or implicitly when only one was shown — plus the search-understanding tier: synonyms,
// filler words, "cheapest", Pidgin phrasing, typos in service words.
import assert from 'node:assert/strict'
import { test, before, after, beforeEach } from 'node:test'
import { startDb, stopDb, wipeDb, loadBot, say, texts, seedVendor, seedProduct, seedService } from './harness.mjs'

before(async () => { await startDb(); await loadBot() })
after(stopDb)
beforeEach(async () => {
  await wipeDb()
  const { store } = await seedVendor()
  await seedProduct(store, { name: 'Red Sneakers', price: 15000, stock: 5, description: 'Comfortable red sneakers' })
  await seedProduct(store, { name: 'Black Sneakers', price: 9000, stock: 5 })
  await seedProduct(store, { name: 'White Sneakers', price: 30000, stock: 5, featured: true })
  await seedProduct(store, { name: 'Gold Bracelet', price: 22000, stock: 3, category: 'jewelry' })
  const fixit = await seedVendor({ storeName: 'FixIt Yaba', phone: '+2348011110006', city: 'Yaba', state: 'Lagos' })
  await seedService(fixit.store, { title: 'Plumbing', price: 6000, category: 'repairs', description: 'Pipe leaks, taps, toilets' })
})

test('cards are numbered and a bare number adds that card', async () => {
  const cards = texts(await say('sneakers'))
  assert.match(cards, /1\. .*Sneakers/)
  assert.match(cards, /2\. .*Sneakers/)
  const second = cards.match(/2\. (\w+ Sneakers)/)[1]
  const added = texts(await say('2'))
  assert.match(added, new RegExp(`Added: ${second} x1`))
})

test('"the first one" describes the card; "add the first one" adds it', async () => {
  const cards = texts(await say('sneakers'))
  const first = cards.match(/1\. (\w+ Sneakers)/)[1]
  const described = texts(await say('the first one'))
  assert.match(described, new RegExp(`1\\. ${first} — NGN`))
  assert.doesNotMatch(described, /Added:/)
  assert.match(texts(await say('add the first one')), new RegExp(`Added: ${first}`))
})

test('colour references resolve when they are unique', async () => {
  await say('sneakers')
  assert.match(texts(await say('add the gold one')), /couldn't|Which one|no match/i) // no gold sneakers on screen
  assert.match(texts(await say('add the black one')), /Added: Black Sneakers/)
  assert.match(texts(await say('how much is the white one?')), /White Sneakers is listed at NGN 30,000/)
})

test('"yes" and "how much?" with several cards ask which one; with one card they act on it', async () => {
  await say('sneakers')
  assert.match(texts(await say('yes')), /Which one\?\n1\./)
  const prices = texts(await say('how much?'))
  assert.match(prices, /Black Sneakers — NGN 9,000/)
  await say('bracelet')
  assert.match(texts(await say('how much?')), /Gold Bracelet is listed at NGN 22,000/)
  assert.match(texts(await say('yes')), /Added: Gold Bracelet x1/)
})

test('an ordinal past the end says how many cards there were', async () => {
  await say('bracelet')
  assert.match(texts(await say('the second one')), /I only sent 1 item/)
})

test('questions about a single card are answered from the listing', async () => {
  await say('bracelet')
  assert.match(texts(await say('is it original?')), /escrow|report it within/i)
  await say('red sneakers')
  assert.match(texts(await say('do you have it in black?')), /hasn't listed separate colour|black sneakers/i)
})

test('synonyms, filler words and "cheapest" are understood', async () => {
  assert.match(texts(await say('I wan buy shoe')), /Sneakers/)
  assert.match(texts(await say('good quality bracelet')), /Gold Bracelet/)
  const cheapest = texts(await say('cheapest sneakers'))
  assert.ok(cheapest.indexOf('Black Sneakers') < cheapest.indexOf('Red Sneakers'), cheapest)
  assert.match(texts(await say('abeg send me price of sneakers')), /Sneakers/)
})

test('haggling, "how do I order?", "what is this?", "next" and "track" all get sensible replies', async () => {
  assert.match(texts(await say('last price?')), /can't negotiate|budget/i)
  assert.match(texts(await say('how do I order?')), /checkout/i)
  assert.match(texts(await say('are you a bot?')), /shopping assistant/i)
  await say('sneakers')
  assert.doesNotMatch(texts(await say('next')), /couldn't find/i)
  assert.match(texts(await say('track MIS-1234')), /haven't placed an order|order/i)
})

test('a misspelt service word still finds the provider', async () => {
  const body = texts(await say('plumbr in yaba'))
  assert.match(body, /FixIt Yaba/)
  assert.match(body, /2348011110006/)
})
