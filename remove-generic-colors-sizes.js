const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://arnoldeee123_db_user:c0a2ScyZW65Mp2cT@cluster0.pg3ptds.mongodb.net/test";

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  images: { type: [String], default: [] },
  vendorId: { type: String, required: true },
  vendorName: { type: String },
  category: { type: String },
  subcategory: { type: String },
  stock: { type: Number, default: 0 },
  sku: { type: String },
  featured: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'inactive', 'out_of_stock'], default: 'active' },
  sales: { type: Number, default: 0 },
  hasColorOptions: { type: Boolean, default: false },
  hasSizeOptions: { type: Boolean, default: false },
  colors: { type: [String], default: [] },
  sizes: { type: [String], default: [] },
  colorImages: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

const Product = mongoose.model('Product', ProductSchema);

async function main() {
  await mongoose.connect(MONGODB_URI);
  
  console.log('Removing generic colors and sizes from all products...\n');
  
  // Reset all products to have no colors/sizes (vendors will add them manually)
  const result = await Product.updateMany(
    {},
    {
      $set: {
        hasColorOptions: false,
        hasSizeOptions: false,
        colors: [],
        sizes: [],
        colorImages: {}
      }
    }
  );
  
  console.log(`✅ Reset ${result.modifiedCount} products`);
  console.log('All products now have empty colors/sizes.');
  console.log('Vendors can now add specific colors/sizes when editing products.\n');
  
  await mongoose.disconnect();
}

main().catch(console.error);
