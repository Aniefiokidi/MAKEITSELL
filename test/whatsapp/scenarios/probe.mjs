import { startDb, stopDb, wipeDb, loadBot, say, texts, seedVendor, seedProduct, seedService } from './harness.mjs'
await startDb(); await loadBot(); await wipeDb()
const { store } = await seedVendor()
await seedProduct(store, { name: 'Red Sneakers', price: 15000, stock: 5 })
await seedProduct(store, { name: 'iPhone 13 Case', price: 4500, stock: 9, category: 'electronics' })
await seedProduct(store, { name: 'Gold Bracelet', price: 22000, stock: 3, category: 'jewelry' })
const lekki = await seedVendor({ storeName: 'Lekki Lens', phone: '+2348011110005', city: 'Lekki', state: 'Lagos' })
await seedService(lekki.store, { title: 'Wedding Photography', price: 150000, category: 'photography', description: 'Full-day wedding coverage' })
const fixit = await seedVendor({ storeName: 'FixIt Yaba', phone: '+2348011110006', city: 'Yaba', state: 'Lagos' })
await seedService(fixit.store, { title: 'Generator Repair', price: 10000, category: 'repairs', description: 'Generator and inverter servicing', pricingType: 'per-session' })
await seedService(fixit.store, { title: 'Plumbing', price: 6000, category: 'repairs', description: 'Pipe leaks, taps, toilets' })

const probes = process.argv.slice(2).length ? [process.argv.slice(2)] : [
  ['plumber in yaba', 'the first one'],
  ['plumber in yaba', '1'],
  ['plumber in yaba', 'send me their number'],
  ['plumber in yaba', 'any cheaper?'],
  ['plumber in yaba', 'book the first one'],
  ['I need sneakers and a plumber'],
  ['cancel my order'],
  ['I haven\'t received my order'],
  ['I want to return the shoes I bought'],
  ['are you open now?'],
  ['thank you, bye'],
  ['bye'],
  ['sneakers', 'add 1', 'actually remove it'],
  ['sneakers', 'add 1', 'change quantity to 3'],
  ['sneakers', 'add 1', 'I want 3 instead'],
  ['sneakers', 'add 1', 'clear cart'],
  ['sneakers', 'add 1', 'proceed'],
  ['sneakers', 'add 1', 'pay now'],
  ['sneakers', 'add 1', 'buy now'],
  ['sneakers', 'add 1', 'how much is my total?'],
]
for (const convo of probes) {
  await wipeDb(); // fresh state per conversation but keep catalog? wipe removes catalog — reseed quickly
  await (async () => {
    const { store } = await seedVendor()
    await seedProduct(store, { name: 'Red Sneakers', price: 15000, stock: 5 })
    await seedProduct(store, { name: 'iPhone 13 Case', price: 4500, stock: 9, category: 'electronics' })
    await seedProduct(store, { name: 'Gold Bracelet', price: 22000, stock: 3, category: 'jewelry' })
    const lekki = await seedVendor({ storeName: 'Lekki Lens', phone: '+2348011110005', city: 'Lekki', state: 'Lagos' })
    await seedService(lekki.store, { title: 'Wedding Photography', price: 150000, category: 'photography', description: 'Full-day wedding coverage' })
    const fixit = await seedVendor({ storeName: 'FixIt Yaba', phone: '+2348011110006', city: 'Yaba', state: 'Lagos' })
    await seedService(fixit.store, { title: 'Generator Repair', price: 10000, category: 'repairs', description: 'Generator and inverter servicing', pricingType: 'per-session' })
    await seedService(fixit.store, { title: 'Plumbing', price: 6000, category: 'repairs', description: 'Pipe leaks, taps, toilets' })
  })()
  for (const msg of convo) {
    const replies = await say(msg)
    console.log(`\n>>> ${msg}`)
    console.log(texts(replies).split('\n').filter((l) => !/^WhatsApp: https|^Message them|^Contact:|^$/.test(l)).slice(0, 12).map((l) => '    ' + l).join('\n'))
  }
}
await stopDb()
