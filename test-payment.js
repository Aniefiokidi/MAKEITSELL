const testPaymentAPI = async () => {
  try {
    const testOrderData = {
      items: [
        {
          productId: "test-product-1",
          title: "Test Product",
          quantity: 1,
          price: 1000,
          vendorId: "test-vendor",
          vendorName: "Test Vendor"
        }
      ],
      shippingInfo: {
        firstName: "John",
        lastName: "Doe",
        email: "test@example.com",
        phone: "08012345678",
        address: "123 Test Street",
        city: "Lagos",
        state: "Lagos",
        zipCode: "100001",
        country: "Nigeria"
      },
      paymentMethod: "paystack",
      customerId: "test-customer-123",
      totalAmount: 1000
    }

    console.log('Testing payment API with data:', testOrderData)

    const response = await fetch('http://localhost:3005/api/payments/initialize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testOrderData)
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('API Error:', response.status, errorData)
      return
    }

    const result = await response.json()
    console.log('Payment API Success:', result)

  } catch (error) {
    console.error('Test failed:', error)
  }
}

testPaymentAPI()