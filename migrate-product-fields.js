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
  
  console.log('Migrating product fields...\n');
  
  // Update all products that don't have the new fields
  const result = await Product.updateMany(
    {
      $or: [
        { hasColorOptions: { $exists: false } },
        { hasSizeOptions: { $exists: false } },
        { colors: { $exists: false } },
        { sizes: { $exists: false } },
        { colorImages: { $exists: false } }
      ]
    },
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
  
  console.log(`Updated ${result.modifiedCount} products with default values\n`);
  
  // Verify the update
  const products = await Product.find({}).lean();
  console.log('Sample product after migration:');
  if (products.length > 0) {
    const sample = products[0];
    console.log(`  Name: ${sample.name}`);
    console.log(`  Has Color Options: ${sample.hasColorOptions}`);
    console.log(`  Has Size Options: ${sample.hasSizeOptions}`);
    console.log(`  Colors: ${JSON.stringify(sample.colors)}`);
    console.log(`  Sizes: ${JSON.stringify(sample.sizes)}`);
    console.log(`  Color Images: ${JSON.stringify(sample.colorImages)}`);
  }
  
  console.log('\nMigration complete!');
  
  await mongoose.disconnect();
}

main().catch(console.error);
