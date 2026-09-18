// Meta-shaped webhook messages through lib/whatsapp/inbound.ts: duplicate deliveries
// are skipped, a location pin is routed, and a handler crash gets an apology instead
// of silence.
import assert from 'node:assert/strict'
import path from 'node:path'
import { test, before, after, beforeEach } from 'node:test'
import { startDb, stopDb, wipeDb, loadBot, texts, seedVendor, seedProduct, seedService, BUYER } from './harness.mjs'
import { outbox, typingCalls } from './stub-client.mjs'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..')
let inbound
before(async () => { await startDb(); await loadBot(); inbound = await import(path.join(ROOT, 'lib/whatsapp/inbound.ts')) })
after(stopDb)
beforeEach(async () => {
  await wipeDb()
  const { store } = await seedVendor()
  await seedProduct(store, { name: 'Red Sneakers', price: 15000, stock: 5 })
})

let seq = 0
const textMessage = (body, id = `wamid.in.${++seq}`) => ({ id, from: BUYER, type: 'text', text: { body } })

async function deliver(message) {
  const start = outbox.length
  await inbound.processInboundMessage(message)
  return outbox.slice(start)
}

test('the same message id delivered twice is handled once', async () => {
  await deliver(textMessage('sneakers'))
  const first = await deliver(textMessage('1', 'wamid.dup'))
  assert.match(texts(first), /Added: Red Sneakers x1/)
  const second = await deliver(textMessage('1', 'wamid.dup'))
  assert.equal(second.length, 0)
  const cart = await deliver(textMessage('cart'))
  assert.match(texts(cart), /Red Sneakers x1 —/)
})

test('a location pin payload reaches the services flow', async () => {
  const fixit = await seedVendor({ storeName: 'FixIt Yaba', phone: '+2348011110006', city: 'Yaba', state: 'Lagos' })
  await seedService(fixit.store, { title: 'Plumbing', price: 6000, category: 'repairs' })
  await deliver(textMessage('plumber'))
  const replies = await deliver({ id: 'wamid.loc', from: BUYER, type: 'location', location: { latitude: 6.5095, longitude: 3.3711, name: 'Yaba' } })
  assert.match(texts(replies), /FixIt Yaba/)
})

test('a handler crash apologises instead of going silent', async () => {
  const start = outbox.length
  await inbound.processInboundMessage(textMessage('sneakers', 'wamid.bad'), async () => { throw new Error('boom') })
  const replies = outbox.slice(start)
  assert.equal(replies.length, 1)
  assert.match(replies[0].body, /something went wrong/i)
})

test('a non-string text body is treated as unsupported, not searched', async () => {
  const replies = await deliver({ id: 'wamid.obj', from: BUYER, type: 'text', text: { body: { nested: true } } })
  assert.match(texts(replies), /can't read/i)
})

test('unsupported message types get a nudge', async () => {
  const replies = await deliver({ id: 'wamid.audio', from: BUYER, type: 'audio', audio: { id: 'x' } })
  assert.match(texts(replies), /can't read voice notes/i)
})

test('every inbound message triggers a read receipt and typing indicator', async () => {
  const before = typingCalls.length
  await deliver(textMessage('hello', 'wamid.typing.1'))
  assert.ok(typingCalls.includes('wamid.typing.1'))
  assert.equal(typingCalls.length, before + 1)
})
