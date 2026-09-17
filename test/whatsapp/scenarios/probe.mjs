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
  ['nike sneakers'],
  ['black leather sneakers'],
  ['sneakers', 'the cheaper one'],
  ['sneakers', 'the expensive one'],
  ['sneakers', "I'll take both"],
  ['sneakers', 'add all'],
  ['sneakers', 'I want five'],
  ['bawo'],
  ['kedu'],
  ['sannu'],
  ['hello?'],
  ['wetin be the price of sneakers'],
  ['sneakers', 'send me the picture'],
  ['reorder'],
  ['sneakers', 'which one is better?'],
  ['sneakers', 'compare them'],
  ['sneakers', 'what is the difference?'],
  ['sneakers', 'add 1', 'what did I add?'],
  ['sneakers', 'add 1', 'how many items in my cart?'],
  ['do you sell phones?'],
]
for (const convo of probes) {
  await wipeDb(); // fresh state per conversation but keep catalog? wipe removes catalog — reseed quickly
  await (async () => {
    const { store } = await seedVendor()
    await seedProduct(store, { name: 'Red Sneakers', price: 15000, stock: 5 })
    await seedProduct(store, { name: 'Black Sneakers', price: 9000, stock: 5 })
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
