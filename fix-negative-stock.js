const mongoose = require('mongoose');

// Use environment variable directly or provide a fallback
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/makeitsell';

// Product model definition
const ProductSchema = new mongoose.Schema({
  title: String,
  description: String,
  price: Number,
  category: String,
  images: [String],
  stock: { type: Number, default: 0 },
  vendorId: String,
  status: { type: String, default: 'active' }
}, { timestamps: true });

const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

async function fixNegativeStock() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Find all products with negative stock
    const negativeStockProducts = await Product.find({ stock: { $lt: 0 } });
    console.log(`Found ${negativeStockProducts.length} products with negative stock`);

    if (negativeStockProducts.length > 0) {
      // Update all negative stock values to 0
      const updateResult = await Product.updateMany(
        { stock: { $lt: 0 } },
        { $set: { stock: 0 } }
      );
      
      console.log(`Updated ${updateResult.modifiedCount} products to have 0 stock`);

      // Log the products that were updated
      negativeStockProducts.forEach(product => {
        console.log(`- ${product.title} (ID: ${product._id}): ${product.stock} -> 0`);
      });
    } else {
      console.log('No products with negative stock found.');
    }

    console.log('Stock fix completed successfully!');
    
  } catch (error) {
    console.error('Error fixing negative stock:', error);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the fix
fixNegativeStock();