import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const uri = process.env.MONGODB_URI
const NEW_ADDRESS = '6a, Sacred heart, Victory Estate, Ajah'
const NEW_CITY = 'Ajah'
const NEW_STATE = 'Lagos'

const client = new MongoClient(uri)

async function main() {
  await client.connect()
  const db = client.db()

  // Search broadly for any store with munch in the name
  const stores = await db.collection('stores').find({ storeName: { $regex: /munch/i } }).toArray()
  if (stores.length === 0) {
    console.log('No stores matching "munch" found. Listing all store names:')
    const all = await db.collection('stores').find({}, { projection: { storeName: 1, address: 1 } }).limit(50).toArray()
    all.forEach(s => console.log(' -', s.storeName, '|', s.address))
    return
  }

  console.log('Found', stores.length, 'store(s):')
  stores.forEach(s => console.log(' -', s._id, '|', s.storeName, '|', s.address))

  const result = await db.collection('stores').updateMany(
    { storeName: { $regex: /munch/i } },
    {
      $set: {
        address: NEW_ADDRESS,
        city: NEW_CITY,
        state: NEW_STATE,
        updatedAt: new Date(),
      },
    }
  )
  console.log('Updated:', result.modifiedCount, 'document(s)')
  console.log('New address set to:', NEW_ADDRESS)
}

main().catch(console.error).finally(() => client.close())
