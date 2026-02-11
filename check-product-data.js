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
  
  // Get all products and show their color/size data
  const products = await Product.find({}).lean();
  
  console.log('\n=== ALL PRODUCTS ===\n');
  products.forEach(product => {
    console.log(`\nProduct: ${product.name || 'Unnamed'}`);
    console.log(`  ID: ${product._id}`);
    console.log(`  Has Color Options: ${product.hasColorOptions}`);
    console.log(`  Has Size Options: ${product.hasSizeOptions}`);
    console.log(`  Colors: ${JSON.stringify(product.colors)}`);
    console.log(`  Sizes: ${JSON.stringify(product.sizes)}`);
    console.log(`  Color Images: ${JSON.stringify(product.colorImages)}`);
  });
  
  console.log(`\n\nTotal Products: ${products.length}\n`);
  
  await mongoose.disconnect();
}

main().catch(console.error);
