/**
 * VENDOR WALLET CREDIT FIX - COMPLETE GUIDE
 * =========================================
 * 
 * Problem: Orders placed with wallet payment didn't credit vendor wallets
 * Reason: Stores not linked to User accounts (linkedWalletUserId was empty)
 * 
 * SOLUTION STEPS:
 * ===============
 * 
 * Step 1: Link stores to user accounts
 * -------------------------------------
 * Run: node link-stores-to-users.js
 * 
 * This automatically links stores to vendor user accounts by matching:
 * - Store name with vendor business name
 * - Store name with vendor user name
 * 
 * If automatic linking fails for some stores, you'll see a list of vendor
 * users at the end. Then manually link using:
 * 
 * Run: node manual-store-link.js <vendorId> <userId>
 * Example: node manual-store-link.js JLC 6992d29fe8074a5db2b5e588
 * 
 * 
 * Step 2: Backfill product storeIds (optional but recommended)
 * ------------------------------------------------------------
 * Run: node backfill-product-storeids.js
 * 
 * This links products to their stores for future orders.
 * 
 * 
 * Step 3: Retry crediting for the failed order
 * ---------------------------------------------
 * Run: node retry-vendor-credit.js <orderId>
 * 
 * You can find the orderId from the recent order or by checking:
 * Run: node list-recent-orders.js
 * 
 * The retry script will:
 * - Check if vendors were already credited
 * - Credit only vendors that haven't received payment
 * - Show detailed output for each vendor
 * 
 * 
 * VERIFICATION:
 * =============
 * After running these scripts, verify:
 * 
 * 1. Check vendor wallet balances:
 *    Run: node check-vendor-wallets.js
 * 
 * 2. Check store wallet balances:
 *    Run: node check-store-wallets.js
 * 
 * 3. Try placing a new order to ensure future orders work correctly
 * 
 * 
 * FUTURE PREVENTION:
 * ==================
 * The app now handles this automatically when creating stores.
 * When a vendor creates a store, it will automatically be linked to their
 * user account via the linkedWalletUserId field.
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
  customerId: String,
  paymentStatus: String,
  paymentMethod: String,
  totalAmount: Number,
  vendors: Array,
  createdAt: Date,
});

const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);

async function listRecentOrders() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');
    console.log('=== Recent Completed Orders ===\n');

    const orders = await Order.find({ 
      paymentStatus: 'completed',
      paymentMethod: 'wallet'
    })
    .sort({ createdAt: -1 })
    .limit(10);

    if (orders.length === 0) {
      console.log('No completed wallet orders found.');
      return;
    }

    orders.forEach((order, idx) => {
      console.log(`${idx + 1}. Order ID: ${order.orderId}`);
      console.log(`   Date: ${order.createdAt}`);
      console.log(`   Amount: ₦${order.totalAmount}`);
      console.log(`   Vendors: ${order.vendors?.length || 0}`);
      console.log(`   Payment: ${order.paymentMethod} (${order.paymentStatus})`);
      console.log('');
    });

    console.log('\nTo retry crediting vendors for an order:');
    console.log('Run: node retry-vendor-credit.js <orderId>');
    console.log('\nExample: node retry-vendor-credit.js', orders[0]?.orderId || '<orderId>');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  listRecentOrders();
}

module.exports = { listRecentOrders };
