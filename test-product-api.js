// Test what the API returns for a product
const productId = '6973c1790a1c4c9284d59ddb'; // The shirt product

async function testAPI() {
  try {
    const response = await fetch(`http://localhost:3000/api/database/products?id=${productId}`);
    const data = await response.json();
    
    console.log('\n=== API Response ===\n');
    console.log('Success:', data.success);
    console.log('Data:', JSON.stringify(data.data, null, 2));
    
    if (data.data && data.data[0]) {
      const product = data.data[0];
      console.log('\n=== Product Fields ===');
      console.log('hasColorOptions:', product.hasColorOptions);
      console.log('hasSizeOptions:', product.hasSizeOptions);
      console.log('colors:', product.colors);
      console.log('sizes:', product.sizes);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAPI();
