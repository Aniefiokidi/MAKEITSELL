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
  ['how much is the red sneakers'],
  ["I'm looking for a gift for my wife"],
  ['sneakers size 42'],
  ['do you deliver to Abuja?'],
  ["what's your return policy?"],
  ['how do I pay?'],
  ['ok'],
  ['add'],
  ['2'],
  ['talk to a human'],
  ['how much be this?'],
  ['I want to buy a phone', 'iphone'],
  ['photographer for my wedding in lekki'],
  ['I need a plumber urgently', 'Yaba'],
  ['who can fix my generator?', 'surulere'],
  ['I need a cleaner', 'Lagos'],
  ['services', 'photographer'],
  ['shop', 'bracelet under 30k'],
  ['wetin una get?'],
  ['I need someone to fix my generator in Yaba'],
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
