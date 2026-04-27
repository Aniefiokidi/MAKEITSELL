import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const uri = process.env.MONGODB_URI;

// List of Nigerian states for matching
const STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River',
  'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano',
  'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun',
  'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara', 'Federal Capital Territory', 'Abuja'
];

function extractState(address = '') {
  // Try to find a state name in the address string
  for (const state of STATES) {
    const regex = new RegExp(`\\b${state}\\b`, 'i');
    if (regex.test(address)) return state;
  }
  return '';
}

async function updateStoreStates() {
  const client = await MongoClient.connect(uri);
  const coll = client.db('test').collection('stores');

  const cursor = coll.find({ $or: [ { state: { $exists: false } }, { state: '' }, { state: null } ] });
  let updated = 0;
  while (await cursor.hasNext()) {
    const store = await cursor.next();
    const address = store.address || '';
    const detectedState = extractState(address);
    if (detectedState) {
      await coll.updateOne({ _id: store._id }, { $set: { state: detectedState } });
      updated++;
      console.log(`Updated store ${store.storeName || store._id}: state -> ${detectedState}`);
    }
  }
  await client.close();
  console.log(`\nDone. Updated ${updated} stores with detected state.`);
}

updateStoreStates().catch(console.error);
