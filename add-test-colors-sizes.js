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
  
  // Update the specific shirt product from the screenshot
  const productId = '6973c1790a1c4c9284d59ddb';
  
  console.log('Adding colors and sizes to the shirt product...\n');
  
  const updatedProduct = await Product.findByIdAndUpdate(
    productId,
    {
      $set: {
        hasColorOptions: true,
        hasSizeOptions: true,
        colors: ['Red', 'Pink', 'White'],
        sizes: ['S', 'M', 'L', 'XL'],
      }
    },
    { new: true }
  ).lean();
  
  if (updatedProduct) {
    console.log('✅ Product updated successfully!');
    console.log(`   Name: ${updatedProduct.name}`);
    console.log(`   Colors: ${updatedProduct.colors.join(', ')}`);
    console.log(`   Sizes: ${updatedProduct.sizes.join(', ')}`);
  } else {
    console.log('❌ Product not found!');
  }
  
  console.log('\nNow refresh your browser and the colors/sizes will appear!\n');
  
  await mongoose.disconnect();
}

main().catch(console.error);
