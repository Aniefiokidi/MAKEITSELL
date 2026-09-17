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
  ['sneakers', 'the first one', 'how much is the second one', '2', 'add the red one'],
  ['I wan buy shoe'],
  ['abeg send me price of sneakers'],
  ['how much for the sneakers'],
  ['cheapest sneakers'],
  ['good quality bracelet'],
  ['last price for sneakers?'],
  ['can I get a discount'],
  ['how do I order?'],
  ['I want to order sneakers'],
  ['track MIS-1234'],
  ['plumbr in yaba'],
  ['hello I want to buy sneakers'],
  ['sneakers', 'add 2'],
  ['sneakers', 'I want 2'],
  ['sneakers', 'yes'],
  ['bracelet', 'is it original?'],
  ['sneakers', 'do you have it in black?'],
  ['sneakers', 'next'],
  ['what is makeitsell?'],
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
