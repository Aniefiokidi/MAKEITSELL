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
  ['sneakers', 'I want 2 of the black one'],
  ['sneakers', '3 of number 1'],
  ['sneakers', 'two of the first one'],
  ['I need to buy sneakers for my son'],
  ['good day'],
  ['hi there'],
  ['🔥'],
  ['sneakers', '1', 'checkout', 'my name is David Okafor', '12 Allen Avenue Ikeja Lagos'],
  ['sneakers', '1', 'checkout', 'David Okafor', 'how much is delivery?'],
  ['sneakers', '1', 'checkout', 'David', 'cancel', 'cart'],
  ['sneakers', '1', 'bracelet', '1', 'cart', 'remove 2', 'cart'],
  ['sneakers', 'add 1', 'add 1', 'cart'],
  ['sneakers under 5k'],
  ['sneakers between 10k and 20k'],
  ['sneakers around 15k'],
  ['I have 20k, what can I buy?'],
  ['sneakers', 'is number 2 available?'],
  ['sneakers', 'what colours does the first one come in?'],
  ['red sneakers', 'add', 'checkout'],
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
