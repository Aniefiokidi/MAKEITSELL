/**
 * Retry crediting vendors for a specific order
 * Usage: node retry-vendor-credit.js <orderId>
 */

const mongoose = require('mongoose');
const dns = require('dns');

const MONGODB_URI = "mongodb+srv://arnoldeee123_db_user:c0a2ScyZW65Mp2cT@cluster0.pg3ptds.mongodb.net/test";

// Configure DNS for MongoDB SRV lookup
if (MONGODB_URI.startsWith('mongodb+srv://')) {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
  console.log('[DNS] Using Google/Cloudflare DNS for SRV lookup');
}

const OrderSchema = new mongoose.Schema({
  orderId: String,
  vendors: Array,
  paymentStatus: String,
  paymentReference: String,
  paymentMethod: String,
});

const UserSchema = new mongoose.Schema({
  email: String,
  name: String,
  role: String,
  walletBalance: { type: Number, default: 0 },
});

const StoreSchema = new mongoose.Schema({
  storeName: String,
  vendorId: String,
  linkedWalletUserId: String,
  walletBalance: { type: Number, default: 0 },
});

const WalletTransactionSchema = new mongoose.Schema({
  userId: String,
  type: String,
  amount: Number,
  status: String,
  reference: String,
  paymentReference: String,
  provider: String,
  note: String,
  metadata: mongoose.Schema.Types.Mixed,
  orderId: String,
  storeId: String,
  createdAt: Date,
  updatedAt: Date,
});

const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Store = mongoose.models.Store || mongoose.model('Store', StoreSchema);
const WalletTransaction = mongoose.models.WalletTransaction || mongoose.model('WalletTransaction', WalletTransactionSchema);

async function retryVendorCredit() {
  const orderId = process.argv[2];
  
  if (!orderId) {
    console.log('Usage: node retry-vendor-credit.js <orderId>');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    const order = await Order.findOne({ orderId });
    if (!order) {
      console.error(`✗ Order not found: ${orderId}`);
      process.exit(1);
    }

    console.log(`Order: ${orderId}`);
    console.log(`Payment Status: ${order.paymentStatus}`);
    console.log(`Payment Method: ${order.paymentMethod}`);
    console.log(`Vendors: ${order.vendors?.length || 0}\n`);

    if (order.paymentStatus !== 'completed') {
      console.error('✗ Order payment is not completed. Cannot credit vendors.');
      process.exit(1);
    }

    let creditedVendors = 0;
    let creditedStores = 0;
    let totalCredited = 0;
    let skipped = 0;

    for (const vendorEntry of order.vendors || []) {
      console.log(`\n--- Processing Vendor: ${vendorEntry.vendorId} ---`);
      
      try {
        const vendorId = String(vendorEntry.vendorId || '').trim();
        if (!vendorId) {
          console.log('  ✗ Empty vendorId, skipping');
          skipped++;
          continue;
        }

        const items = Array.isArray(vendorEntry.items) ? vendorEntry.items : [];
        const amount = typeof vendorEntry.total === 'number'
          ? vendorEntry.total
          : items.reduce((sum, item) => {
              return sum + (Number(item?.price || 0) * Number(item?.quantity || 1));
            }, 0);

        const normalizedAmount = Math.round(amount * 100) / 100;
        
        if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
          console.log(`  ✗ Invalid amount: ${normalizedAmount}, skipping`);
          skipped++;
          continue;
        }

        console.log(`  Amount: ₦${normalizedAmount}`);

        // Find store by vendorId
        const store = await Store.findOne({ vendorId }).sort({ createdAt: -1 });
        
        if (!store) {
          console.log(`  ✗ Store not found for vendorId: ${vendorId}`);
          skipped++;
          continue;
        }

        console.log(`  Store: ${store.storeName} (${store._id})`);

        // Get wallet user ID
        const walletUserId = store.linkedWalletUserId;
        
        if (!walletUserId || !mongoose.Types.ObjectId.isValid(walletUserId)) {
          console.log(`  ✗ Store not linked to user wallet (linkedWalletUserId: ${walletUserId || 'null'})`);
          console.log(`  → Run: node manual-store-link.js ${vendorId} <userId>`);
          skipped++;
          continue;
        }

        // Check if already credited
        const reference = `vendor_order_credit_${orderId}_${vendorId}`;
        const existingTx = await WalletTransaction.findOne({ reference });
        
        if (existingTx) {
          console.log(`  ✓ Already credited (transaction exists)`);
          continue;
        }

        // Create transaction
        await WalletTransaction.create({
          userId: walletUserId,
          type: 'vendor_credit',
          amount: normalizedAmount,
          status: 'completed',
          reference,
          paymentReference: order.paymentReference || `order_${orderId}`,
          provider: order.paymentMethod || 'wallet',
          note: `Order payout for ${orderId}`,
          metadata: {
            source: 'manual_retry',
            orderId,
            vendorId,
            walletUserId,
          },
          orderId,
          storeId: store._id.toString(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Credit vendor wallet
        const vendorResult = await User.updateOne(
          { _id: walletUserId, role: 'vendor' },
          {
            $inc: { walletBalance: normalizedAmount },
            $set: { updatedAt: new Date() },
          }
        );

        // Credit store wallet
        const storeResult = await Store.updateOne(
          { _id: store._id },
          {
            $inc: { walletBalance: normalizedAmount },
            $set: { updatedAt: new Date() },
          }
        );

        console.log(`  ✓ Credited vendor wallet: ${vendorResult.modifiedCount > 0 ? 'YES' : 'NO'}`);
        console.log(`  ✓ Credited store wallet: ${storeResult.modifiedCount > 0 ? 'YES' : 'NO'}`);

        if (vendorResult.modifiedCount > 0) creditedVendors++;
        if (storeResult.modifiedCount > 0) creditedStores++;
        totalCredited += normalizedAmount;

      } catch (err) {
        console.error(`  ✗ Error:`, err.message);
        skipped++;
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Credited Vendors: ${creditedVendors}`);
    console.log(`Credited Stores: ${creditedStores}`);
    console.log(`Total Credited: ₦${totalCredited.toFixed(2)}`);
    console.log(`Skipped: ${skipped}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

retryVendorCredit();
