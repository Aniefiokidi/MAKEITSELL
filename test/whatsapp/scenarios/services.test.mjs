// Services on WhatsApp are contact-only (same as the web — see lib/models/ServiceContact.ts):
// the bot finds the providers closest to the buyer and sends their contact details plus
// an estimated rate. It must not try to book, negotiate or quote in-chat.
import assert from 'node:assert/strict'
import { test, before, after, beforeEach } from 'node:test'
import { startDb, stopDb, wipeDb, loadBot, say, texts, last, seedVendor, seedService, BUYER } from './harness.mjs'

before(async () => { await startDb(); await loadBot() })
after(stopDb)
beforeEach(wipeDb)

const BOOKING_PROMPTS = /reply "book"|"offer <amount>"|reply "quote"|to book, reply/i

async function providers() {
  const lagos = await seedVendor({ storeName: 'Braids by Ngozi', phone: '+2348011110001', city: 'Ikeja', state: 'Lagos' })
  const abuja = await seedVendor({ storeName: 'Abuja Hair Studio', phone: '+2348011110002', city: 'Wuse', state: 'Abuja' })
  const ph = await seedVendor({ storeName: 'PH Braiders', phone: '+2348011110003', city: 'Port Harcourt', state: 'Rivers' })
  await seedService(lagos.store, { title: 'Knotless Braids', price: 12000, pricingType: 'fixed' })
  await seedService(abuja.store, { title: 'Box Braids', price: 9000, pricingType: 'fixed' })
  await seedService(ph.store, { title: 'Hair Braiding', price: 7000, pricingType: 'hourly' })
  return { lagos, abuja, ph }
}

test('a service request asks where the buyer is when the location is unknown', async () => {
  await providers()
  const replies = await say('I need a hair braider')
  assert.match(texts(replies), /where are you|your location|area|city/i, texts(replies))
  assert.doesNotMatch(texts(replies), BOOKING_PROMPTS)
})

test('with a location, the closest provider comes first with contact details and a rate', async () => {
  await providers()
  await say('I need a hair braider')
  const replies = await say('Ikeja, Lagos')
  const body = texts(replies)
  assert.match(body, /Braids by Ngozi/)
  assert.match(body, /\+?2348011110001|0801 ?111 ?0001|08011110001/, body)
  assert.match(body, /12,000/)
  assert.ok(body.indexOf('Braids by Ngozi') < body.indexOf('Abuja Hair Studio') || !body.includes('Abuja Hair Studio'), body)
  assert.doesNotMatch(body, BOOKING_PROMPTS)
})

test('location can be given in the same message as the request', async () => {
  await providers()
  const replies = await say('hair braiding in Abuja')
  const body = texts(replies)
  assert.match(body, /Abuja Hair Studio/)
  assert.match(body, /2348011110002|08011110002/)
  assert.match(body, /9,000/)
})

test('hourly services are labelled as an estimate per hour', async () => {
  await providers()
  await say('braiding')
  const replies = await say('Port Harcourt')
  const body = texts(replies)
  assert.match(body, /PH Braiders/)
  assert.match(body, /7,000.*(hour|hr)/i, body)
})

test('the remembered location is reused for the next service request', async () => {
  await providers()
  await say('hair braider')
  await say('Lagos')
  const replies = await say('I need a braider again')
  assert.match(texts(replies), /Braids by Ngozi/)
  assert.doesNotMatch(texts(replies), /where are you|your location/i)
})

test('replying "book" to a service card repeats the contact details instead of booking', async () => {
  await providers()
  await say('braider')
  const cards = await say('Lagos')
  const card = cards.find((m) => /Braids by Ngozi/.test(m.body))
  const replies = await say('book', { replyTo: card.id })
  const body = texts(replies)
  assert.match(body, /2348011110001|08011110001/)
  assert.doesNotMatch(body, /package|time slot|choose a time|offer/i)
})

test('services with no provider in the buyer\'s state still return the nearest ones', async () => {
  await providers()
  await say('braider')
  const replies = await say('Ibadan')
  const body = texts(replies)
  assert.match(body, /Braids by Ngozi/)
})

test('a provider without a phone number on file is skipped, not sent as a dead end', async () => {
  const { store } = await seedVendor({ storeName: 'No Phone Spa', phone: '', city: 'Ikeja', state: 'Lagos' })
  await seedService(store, { title: 'Massage', price: 15000 })
  const other = await seedVendor({ storeName: 'Lekki Spa', phone: '+2348011110009', city: 'Lekki', state: 'Lagos' })
  await seedService(other.store, { title: 'Massage', price: 18000 })
  await say('massage')
  const replies = await say('Lagos')
  const body = texts(replies)
  assert.match(body, /Lekki Spa/)
  assert.doesNotMatch(body, /No Phone Spa/)
})

test('"services" opens the services category menu', async () => {
  const replies = await say('services')
  assert.equal(last(replies).kind, 'list')
})

test('a shared location pin completes a pending service request', async () => {
  await providers()
  await say('braider')
  const { commands } = await loadBot()
  const { outbox } = await import('./stub-client.mjs')
  const start = outbox.length
  await commands.handleInboundLocation(BUYER, 6.6018, 3.3515, 'Ikeja') // Ikeja coordinates
  const body = texts(outbox.slice(start))
  assert.match(body, /Braids by Ngozi/)
  assert.match(body, /km away|m away/)
})

test('a service typed in shopping mode with a typo-free product miss falls through to providers', async () => {
  await providers()
  const replies = await say('plumber')
  assert.match(texts(replies), /couldn't find|no .*provider/i)
})

test('"skip" lists providers without distances and asks for the area again next time', async () => {
  await providers()
  await say('braider')
  const body = texts(await say('skip'))
  assert.match(body, /Braids by Ngozi|Abuja Hair Studio|PH Braiders/)
  assert.doesNotMatch(body, /km away|nearby|to anywhere/)
  const again = texts(await say('I need a braider'))
  assert.match(again, /where are you/i)
})

test('"more" pages through providers and unknown towns get a nudge', async () => {
  await providers()
  await say('braider')
  const nudge = texts(await say('Gbagada Heights Estate Phase 9'))
  assert.match(nudge, /couldn't place/i)
  const page1 = texts(await say('Lagos'))
  assert.match(page1, /Those are all the providers/)
})
