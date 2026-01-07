#!/usr/bin/env node

/**
 * MongoDB Migration Test Script
 * 
 * This script tests the MongoDB migration to ensure all operations work correctly.
 */

import { connectToDatabase, isMongoDBAvailable } from './lib/mongodb.js'
import * as dbOps from './lib/mongodb-operations.js'
import * as auth from './lib/mongodb-auth.js'

async function testConnection() {
  console.log('🔗 Testing MongoDB connection...')
  try {
    const isAvailable = await isMongoDBAvailable()
    if (isAvailable) {
      console.log('✅ MongoDB connection successful')
      return true
    } else {
      console.log('❌ MongoDB connection failed')
      return false
    }
  } catch (error) {
    console.log('❌ MongoDB connection error:', error.message)
    return false
  }
}

async function testAuthentication() {
  console.log('\n🔐 Testing authentication system...')
  
  try {
    // Test sign up
    console.log('Testing user signup...')
    const signupResult = await auth.signUp({
      email: `test-${Date.now()}@example.com`,
      password: 'testpassword123',
      name: 'Test User',
      role: 'customer'
    })
    
    if (signupResult.success) {
      console.log('✅ User signup successful')
      
      // Test sign in
      console.log('Testing user signin...')
      const signinResult = await auth.signIn(signupResult.user.email, 'testpassword123')
      
      if (signinResult.success) {
        console.log('✅ User signin successful')
        
        // Test get current user
        const currentUser = await auth.getCurrentUser(signinResult.sessionToken)
        if (currentUser.success) {
          console.log('✅ Get current user successful')
        }
        
        return true
      } else {
        console.log('❌ User signin failed')
        return false
      }
    } else {
      console.log('❌ User signup failed')
      return false
    }
  } catch (error) {
    console.log('❌ Authentication test error:', error.message)
    return false
  }
}

async function testDatabaseOperations() {
  console.log('\n📊 Testing database operations...')
  
  try {
    // Test store creation
    console.log('Testing store operations...')
    const storeId = await dbOps.createStore({
      vendorId: 'test-vendor-' + Date.now(),
      storeName: 'Test Store',
      storeDescription: 'A test store',
      storeImage: 'https://example.com/image.jpg',
      category: 'Electronics',
      rating: 4.5,
      reviewCount: 10,
      isOpen: true,
      deliveryTime: '30-45 mins',
      deliveryFee: 5.00,
      minimumOrder: 15.00,
      address: '123 Test St, Test City'
    })
    
    if (storeId) {
      console.log('✅ Store creation successful')
      
      // Test store retrieval
      const stores = await dbOps.getStores({ limitCount: 5 })
      if (stores.length > 0) {
        console.log('✅ Store retrieval successful')
      }
    }
    
    // Test product creation
    console.log('Testing product operations...')
    const productId = await dbOps.createProduct({
      title: 'Test Product',
      description: 'A test product',
      price: 99.99,
      category: 'Electronics',
      images: ['https://example.com/product.jpg'],
      vendorId: 'test-vendor-' + Date.now(),
      vendorName: 'Test Vendor',
      stock: 100,
      featured: true,
      status: 'active'
    })
    
    if (productId) {
      console.log('✅ Product creation successful')
      
      // Test product retrieval
      const products = await dbOps.getProducts({ limitCount: 5 })
      if (products.length > 0) {
        console.log('✅ Product retrieval successful')
      }
    }
    
    // Test service creation
    console.log('Testing service operations...')
    const serviceId = await dbOps.createService({
      providerId: 'test-provider-' + Date.now(),
      providerName: 'Test Provider',
      title: 'Test Service',
      description: 'A test service',
      category: 'Business',
      price: 50.00,
      pricingType: 'hourly',
      images: ['https://example.com/service.jpg'],
      location: 'Test City',
      locationType: 'online',
      availability: {
        monday: { start: '09:00', end: '17:00', available: true },
        tuesday: { start: '09:00', end: '17:00', available: true }
      },
      rating: 4.8,
      reviewCount: 15,
      featured: true,
      status: 'active',
      tags: ['consulting', 'business']
    })
    
    if (serviceId) {
      console.log('✅ Service creation successful')
      
      // Test service retrieval
      const services = await dbOps.getServices({ limitCount: 5 })
      if (services.length > 0) {
        console.log('✅ Service retrieval successful')
      }
    }
    
    return true
  } catch (error) {
    console.log('❌ Database operations test error:', error.message)
    return false
  }
}

async function runTests() {
  console.log('🧪 Starting MongoDB Migration Tests\n')
  
  let allTestsPassed = true
  
  // Test 1: Connection
  const connectionTest = await testConnection()
  if (!connectionTest) allTestsPassed = false
  
  // Test 2: Authentication (only if connection works)
  if (connectionTest) {
    const authTest = await testAuthentication()
    if (!authTest) allTestsPassed = false
    
    // Test 3: Database Operations (only if auth works)
    if (authTest) {
      const dbTest = await testDatabaseOperations()
      if (!dbTest) allTestsPassed = false
    }
  }
  
  console.log('\n📋 Test Results Summary:')
  console.log('========================')
  console.log(`MongoDB Connection: ${connectionTest ? '✅ PASS' : '❌ FAIL'}`)
  if (connectionTest) {
    console.log(`Authentication: ${allTestsPassed ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`Database Operations: ${allTestsPassed ? '✅ PASS' : '❌ FAIL'}`)
  }
  
  if (allTestsPassed) {
    console.log('\n🎉 All tests passed! MongoDB migration is working correctly.')
    console.log('\nNext steps:')
    console.log('1. Start your development server: pnpm dev')
    console.log('2. Test the application in your browser')
    console.log('3. Try logging in with demo credentials:')
    console.log('   - Vendor: admin@techempire.ng / TechEmp123!')
    console.log('   - Customer: customer@example.com / password123')
    console.log('4. Try creating new accounts and data')
  } else {
    console.log('\n⚠️ Some tests failed. Please check the MongoDB setup:')
    console.log('1. Ensure MongoDB is running: mongod')
    console.log('2. Check connection string in .env.local')
    console.log('3. Verify database permissions')
    
    if (!connectionTest) {
      console.log('\n💡 MongoDB Quick Setup:')
      console.log('- Local: mongod --dbpath /path/to/data')
      console.log('- Cloud: Use MongoDB Atlas connection string')
    }
  }
  
  process.exit(allTestsPassed ? 0 : 1)
}

// Run tests
runTests().catch(error => {
  console.error('Test script error:', error)
  process.exit(1)
})