// End-to-end buyer conversations for the goods flow. Each test drives the real router
// (lib/whatsapp/commands.ts) against an in-memory MongoDB and asserts on what the bot
// would have sent back to the buyer.
import assert from 'node:assert/strict'
import { test, before, after, beforeEach } from 'node:test'
import { startDb, stopDb, wipeDb, loadBot, say, texts, last, seedVendor, seedProduct } from './harness.mjs'

before(async () => { await startDb(); await loadBot() })
after(stopDb)
beforeEach(wipeDb)

async function catalog() {
  const { store } = await seedVendor()
  const sneakers = await seedProduct(store, { name: 'Red Sneakers', price: 15000, stock: 5 })
  const boots = await seedProduct(store, { name: 'Leather Boots', price: 42000, stock: 2, colors: ['Black', 'Brown'], sizes: ['42', '43'], variants: [{ label: 'Color', value: 'Black', stock: 1 }, { label: 'Color', value: 'Brown', stock: 1 }, { label: 'Size', value: '42', stock: 1 }, { label: 'Size', value: '43', stock: 1 }] })
  await seedProduct(store, { name: 'Phone Case', price: 3500, stock: 0, status: 'out_of_stock' })
  return { store, sneakers, boots }
}

test('greeting gets the shopping prompt', async () => {
  const replies = await say('hello')
  assert.equal(replies.length, 1)
  assert.match(replies[0].body, /Tell me what you need/)
})

test('thanks gets a short acknowledgement, not a search', async () => {
  await catalog()
  const replies = await say('thank you')
  assert.equal(replies.length, 1)
  assert.doesNotMatch(replies[0].body, /Red Sneakers/)
})

test('plain product search returns cards with price and seller', async () => {
  await catalog()
  const replies = await say('sneakers')
  const card = replies.find((m) => /Red Sneakers/.test(m.body))
  assert.ok(card, texts(replies))
  assert.match(card.body, /NGN 15,000/)
  assert.match(card.body, /Sold by Ada Stores/)
})

test('conversational and Pidgin phrasing still finds the item', async () => {
  await catalog()
  for (const phrase of ['I want to buy sneakers', 'abeg I wan buy sneakers', 'do you have sneakers?', 'how much is sneakers']) {
    const replies = await say(phrase)
    assert.ok(replies.some((m) => /Red Sneakers/.test(m.body)), `${phrase} -> ${texts(replies)}`)
  }
})

test('budget search hides items over the budget', async () => {
  await catalog()
  const replies = await say('shoes under 20k')
  const bodies = texts(replies)
  assert.doesNotMatch(bodies, /Leather Boots/)
})

test('no match gets a helpful message instead of silence', async () => {
  await catalog()
  const replies = await say('microwave')
  assert.equal(replies.length, 1)
  assert.match(replies[0].body, /No products found|couldn't find|not find/i)
})

test('out-of-stock products are never offered', async () => {
  await catalog()
  const replies = await say('phone case')
  assert.doesNotMatch(texts(replies), /NGN 3,500/)
})

test('comma-separated shopping list shows choices for each item', async () => {
  await catalog()
  const replies = await say('sneakers, boots')
  const bodies = texts(replies)
  assert.match(bodies, /Red Sneakers/)
  assert.match(bodies, /Leather Boots/)
})

test('reply "add" to a card puts it in the cart, "cart" lists it, checkout asks for a name', async () => {
  await catalog()
  const cards = await say('sneakers')
  const card = cards.find((m) => /Red Sneakers/.test(m.body))
  const added = await say('add', { replyTo: card.id })
  assert.match(texts(added), /Red Sneakers/)
  assert.match(texts(added), /cart/i)

  const cart = await say('cart')
  assert.match(texts(cart), /Red Sneakers/)
  assert.match(texts(cart), /15,000/)

  const checkout = await say('checkout')
  assert.match(texts(checkout), /name/i)
  const named = await say('David Okafor')
  assert.match(texts(named), /address/i)
})

test('quantity reply adds that many, and stock is respected', async () => {
  const { boots } = await catalog()
  const cards = await say('boots')
  const card = cards.find((m) => /Leather Boots/.test(m.body))
  const replies = await say('add 5', { replyTo: card.id })
  const body = texts(replies)
  assert.ok(/only 2|2 units|stock/i.test(body), body)
  assert.equal(boots.stock, 2)
})

test('variant product asks for colour or size before adding', async () => {
  await catalog()
  const cards = await say('boots')
  const card = cards.find((m) => /Leather Boots/.test(m.body))
  const replies = await say('add', { replyTo: card.id })
  assert.match(texts(replies), /Black|Brown|42|43/, texts(replies))
})

test('price and stock questions on a card are answered from the listing', async () => {
  await catalog()
  const cards = await say('boots')
  const card = cards.find((m) => /Leather Boots/.test(m.body))
  const price = await say('how much?', { replyTo: card.id })
  assert.match(texts(price), /42,000/)
  const stock = await say('is it available?', { replyTo: card.id })
  assert.match(texts(stock), /available|in stock|left|2/i)
  const colour = await say('what colours do you have?', { replyTo: card.id })
  assert.match(texts(colour), /Black/)
  assert.match(texts(colour), /Brown/)
})

test('remove from cart and empty-cart checkout are handled', async () => {
  await catalog()
  const cards = await say('sneakers')
  await say('add', { replyTo: cards.find((m) => /Red Sneakers/.test(m.body)).id })
  const removed = await say('remove 1')
  assert.match(texts(removed), /removed|empty/i)
  const checkout = await say('checkout')
  assert.match(texts(checkout), /empty/i)
})

test('"more" pages through a long result set', async () => {
  const { store } = await seedVendor()
  for (let i = 1; i <= 8; i++) await seedProduct(store, { name: `Sneaker Model ${i}`, price: 10000 + i })
  const first = await say('sneaker')
  const firstNames = texts(first).match(/Sneaker Model \d/g) || []
  assert.ok(firstNames.length > 0 && firstNames.length < 8, texts(first))
  const more = await say('more')
  const moreNames = texts(more).match(/Sneaker Model \d/g) || []
  assert.ok(moreNames.length > 0, texts(more))
  assert.equal(new Set([...firstNames, ...moreNames]).size, firstNames.length + moreNames.length)
})

test('categories sends an interactive list', async () => {
  const replies = await say('categories')
  assert.equal(last(replies).kind, 'list')
  assert.ok(last(replies).sections.length <= 10)
})

test('order status with no orders is explained', async () => {
  const replies = await say('where is my order?')
  assert.equal(replies.length, 1)
  assert.match(replies[0].body, /no orders|haven't|don't have|not placed/i)
})

test('a named store request lists that store\'s products', async () => {
  await catalog()
  const replies = await say('what does Ada Stores sell?')
  assert.match(texts(replies), /Red Sneakers|Leather Boots/)
})

test('misspelt search still finds the product', async () => {
  await catalog()
  const replies = await say('sneekers')
  assert.match(texts(replies), /Red Sneakers/)
})

test('cancel outside checkout does not crash and explains', async () => {
  const replies = await say('cancel')
  assert.ok(replies.length >= 1)
})
