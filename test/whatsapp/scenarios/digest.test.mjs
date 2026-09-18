// Conversation logging and the daily digest built from it.
import assert from 'node:assert/strict'
import path from 'node:path'
import { test, before, after, beforeEach } from 'node:test'
import { startDb, stopDb, wipeDb, loadBot, texts, seedVendor, seedProduct, BUYER } from './harness.mjs'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..')
let inbound, Log, digest
before(async () => {
  await startDb(); await loadBot()
  inbound = await import(path.join(ROOT, 'lib/whatsapp/inbound.ts'))
  Log = (await import(path.join(ROOT, 'lib/models/WhatsAppConversationLog.ts'))).WhatsAppConversationLog
  digest = await import(path.join(ROOT, 'lib/whatsapp/digest.ts'))
})
after(stopDb)
beforeEach(async () => {
  await wipeDb()
  const { store } = await seedVendor()
  await seedProduct(store, { name: 'Red Sneakers', price: 15000, stock: 5 })
})

let seq = 0
const msg = (body, from = BUYER) => ({ id: `wamid.log.${++seq}`, from, type: 'text', text: { body } })

test('inbound messages are logged and unanswered ones are tagged', async () => {
  await inbound.processInboundMessage(msg('sneakers'))
  await inbound.processInboundMessage(msg('quantum flux capacitor'))
  await inbound.processInboundMessage(msg('I am looking for something my aunt would like'))
  await inbound.processInboundMessage({ id: 'wamid.log.audio', from: BUYER, type: 'audio', audio: { id: 'x' } })
  const rows = await Log.find({ direction: 'in' }).sort({ createdAt: 1 }).lean()
  assert.equal(rows.length, 4)
  assert.equal(rows[0].outcome, undefined)
  assert.equal(rows[1].outcome, 'no_match')
  assert.equal(rows[2].outcome, 'clarify')
  assert.equal(rows[3].outcome, 'unsupported')
})

test('the digest groups unanswered queries and reports the funnel', async () => {
  await inbound.processInboundMessage(msg('sneakers'))
  await inbound.processInboundMessage(msg('1'))
  await inbound.processInboundMessage(msg('quantum flux capacitor'))
  await inbound.processInboundMessage(msg('Quantum flux capacitor!', '2348099990000'))
  const d = await digest.buildDigest(1)
  assert.equal(d.inbound, 4)
  assert.equal(d.uniqueBuyers, 2)
  assert.equal(d.unanswered.length, 1)
  assert.equal(d.unanswered[0].count, 2)
  const text = digest.formatDigestForWhatsApp(d)
  assert.match(text, /4 messages from 2 buyers/)
  assert.match(text, /"quantum flux capacitor" ×2/)
})
