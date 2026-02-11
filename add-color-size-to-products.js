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
  
  // Find the shirt product (ID from the screenshot: 6973c1790a1c4c9284d59ddb)
  const productId = '6973c1790a1c4c9284d59ddb';
  
  console.log('Updating shirt product with color and size options...\n');
  
  const updatedProduct = await Product.findByIdAndUpdate(
    productId,
    {
      $set: {
        hasColorOptions: true,
        hasSizeOptions: true,
        colors: ['Red', 'Pink', 'White', 'Blue'],
        sizes: ['S', 'M', 'L', 'XL'],
        colorImages: {}
      }
    },
    { new: true }
  ).lean();
  
  if (updatedProduct) {
    console.log('Product updated successfully!');
    console.log(`  Name: ${updatedProduct.name}`);
    console.log(`  Has Color Options: ${updatedProduct.hasColorOptions}`);
    console.log(`  Colors: ${JSON.stringify(updatedProduct.colors)}`);
    console.log(`  Has Size Options: ${updatedProduct.hasSizeOptions}`);
    console.log(`  Sizes: ${JSON.stringify(updatedProduct.sizes)}`);
  } else {
    console.log('Product not found!');
  }
  
  // Also update all other "shirt" products
  const result = await Product.updateMany(
    { 
      name: /shirt/i,
      _id: { $ne: productId }
    },
    {
      $set: {
        hasColorOptions: true,
        hasSizeOptions: true,
        colors: ['Black', 'White', 'Blue', 'Gray'],
        sizes: ['S', 'M', 'L', 'XL', 'XXL']
      }
    }
  );
  
  console.log(`\nUpdated ${result.modifiedCount} additional shirt products\n`);
  
  // Update fashion items (sweaters, jackets, hoodies) with colors and sizes
  const fashionResult = await Product.updateMany(
    { 
      $or: [
        { name: /sweater/i },
        { name: /hoodie/i },
        { name: /jacket/i },
        { name: /bikini/i },
        { category: 'Fashion' }
      ]
    },
    {
      $set: {
        hasColorOptions: true,
        hasSizeOptions: true,
        colors: ['Black', 'White', 'Gray', 'Navy Blue', 'Red'],
        sizes: ['S', 'M', 'L', 'XL', 'XXL']
      }
    }
  );
  
  console.log(`Updated ${fashionResult.modifiedCount} fashion products with colors and sizes\n`);
  
  console.log('Done!');
  
  await mongoose.disconnect();
}

main().catch(console.error);
