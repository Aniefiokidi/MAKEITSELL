import { MongoClient } from 'mongodb';
import * as XLSX from 'xlsx';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const uri = process.env.MONGODB_URI;

async function exportAbujaStores() {
  const client = await MongoClient.connect(uri);
  const coll = client.db('test').collection('stores');
  // Filter for Abuja in city or address (case-insensitive)
  const filter = {
    $or: [
      { city: { $regex: 'abuja', $options: 'i' } },
      { address: { $regex: 'abuja', $options: 'i' } }
    ]
  };
  const cursor = coll.find(filter, {
    projection: {
      storeName: 1,
      address: 1,
      city: 1,
      state: 1,
      phone: 1,
      email: 1,
      _id: 0
    }
  });
  const result = await cursor.toArray();
  await client.close();

  // Prepare data for Excel
  const data = result.map(s => ({
    Name: s.storeName,
    Address: s.address,
    City: s.city,
    State: s.state,
    Phone: s.phone,
    Email: s.email,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Abuja Stores');
  XLSX.writeFile(workbook, 'abuja_stores.xlsx');
  console.log(`Exported ${data.length} Abuja stores to abuja_stores.xlsx`);
}

exportAbujaStores().catch(console.error);
