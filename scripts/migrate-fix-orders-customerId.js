// Migration script to set missing customerId on orders
// Usage: node scripts/migrate-fix-orders-customerId.js

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/YOUR_DB_NAME';

const orderSchema = new mongoose.Schema({}, { strict: false, collection: 'orders' });
const Order = mongoose.model('Order', orderSchema);

async function migrate() {
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  // Find orders missing customerId
  const orders = await Order.find({ $or: [ { customerId: { $exists: false } }, { customerId: null } ] });
  console.log(`Found ${orders.length} orders missing customerId`);

  let updated = 0;
  for (const order of orders) {
    // Try to infer customerId from items or vendors if possible
    let customerId = null;
    if (order.customerEmail && order.items && order.items.length > 0) {
      // If you have a mapping from email to userId, implement here
      // Otherwise, skip
    }
    // If you have a backup field or can infer, set here
    // For now, skip if not found
    if (!customerId) continue;
    order.customerId = customerId;
    await order.save();
    updated++;
  }
  console.log(`Updated ${updated} orders with customerId`);
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
