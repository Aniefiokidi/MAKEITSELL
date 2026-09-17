// Shared setup for WhatsApp scenario tests: boots an in-memory MongoDB (binary cached
// from the after-sales suite), points lib/mongodb at it, and exposes helpers to seed a
// vendor/store/products/services and to "send" buyer messages through the real router
// (lib/whatsapp/commands.ts handleInboundMessage) with the Meta client stubbed out.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import { outbox, resetOutbox } from './stub-client.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const { MongoMemoryReplSet } = await import(path.join(ROOT, 'test/after-sales/node_modules/mongodb-memory-server/index.js'))

let replSet = null
export async function startDb() {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.14' } })
  process.env.MONGODB_URI = replSet.getUri()
  process.env.MONGODB_DB_NAME = 'whatsapp_scenarios'
  process.env.NEXT_PUBLIC_APP_URL = 'https://makeitsell.test'
  // lib/push-notifications.ts calls setVapidDetails at import time; throwaway keypair.
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||= 'BKZdi4clXpt-fqFHIpAo5QDQC__c1w56BJtmRBvg3et9vJwaxW3DlhTiUg1fh03aJMUEbfdTyNVQx5VqynfhFRE'
  process.env.VAPID_PRIVATE_KEY ||= '-8DDmiZmtwRynVN5X34LbBMQMfEcwEVGCWMexKBPNPc'
  process.env.VAPID_SUBJECT ||= 'mailto:test@makeitsell.test'
}
export async function stopDb() {
  await mongoose.disconnect().catch(() => {})
  if (replSet) await replSet.stop()
}
export async function wipeDb() {
  const db = mongoose.connection.db
  if (!db) return
  const collections = await db.collections()
  await Promise.all(collections.map((c) => c.deleteMany({})))
  resetOutbox()
}

// Lazily imported AFTER startDb so lib/mongodb reads the in-memory URI at module load.
let bot = null
export async function loadBot() {
  if (bot) return bot
  const [commands, ops, models, db] = await Promise.all([
    import(path.join(ROOT, 'lib/whatsapp/commands.ts')),
    import(path.join(ROOT, 'lib/mongodb-operations.ts')),
    Promise.all([
      import(path.join(ROOT, 'lib/models/User.ts')),
      import(path.join(ROOT, 'lib/models/Store.ts')),
      import(path.join(ROOT, 'lib/models/Product.ts')),
    ]),
    import(path.join(ROOT, 'lib/mongodb.ts')),
  ])
  await db.connectToDatabase()
  bot = { commands, ops, User: models[0].User, Store: models[1].Store, Product: models[2].Product, ServiceModel: ops.ServiceModel }
  return bot
}

export const BUYER = '2348011112222'

// Sends one inbound text through the router and returns the messages the bot sent back
// (only the new ones since the call started).
export async function say(text, { from = BUYER, replyTo } = {}) {
  const { commands } = await loadBot()
  const start = outbox.length
  await commands.handleInboundMessage(from, text, replyTo)
  return outbox.slice(start)
}
export const texts = (msgs) => msgs.map((m) => m.body || '').join('\n---\n')
export const last = (msgs) => msgs[msgs.length - 1]

export async function seedVendor({ storeName = 'Ada Stores', phone = '+2348099998888', city = 'Ikeja', state = 'Lagos' } = {}) {
  const { User, Store } = await loadBot()
  const vendor = await User.create({ email: `${storeName.replace(/\W+/g, '').toLowerCase()}@test.dev`, name: storeName, role: 'vendor' })
  const store = await Store.create({ storeName, vendorId: String(vendor._id), phone, city, state, address: `1 ${storeName} Road, ${city}`, status: 'approved', isActive: true })
  return { vendor, store }
}

export async function seedProduct(store, overrides = {}) {
  const { Product } = await loadBot()
  const name = overrides.name || 'Red Sneakers'
  return Product.create({
    name, description: `Quality ${name.toLowerCase()} from ${store.storeName}`, price: 15000, stock: 5, category: 'fashion',
    images: ['https://res.cloudinary.com/demo/image/upload/sneakers.jpg'],
    vendorId: String(store.vendorId), storeId: String(store._id), status: 'active',
    ...overrides,
  })
}

export async function seedService(store, overrides = {}) {
  const { ServiceModel } = await loadBot()
  return ServiceModel.create({
    providerId: String(store.vendorId), storeId: String(store._id), providerName: store.storeName,
    title: 'Hair Braiding', description: 'Box braids, knotless braids and more', category: 'beauty',
    price: 8000, pricingType: 'fixed', location: `${store.city}, ${store.state}`, city: store.city, state: store.state,
    locationType: 'local', status: 'active', images: [],
    ...overrides,
  })
}
