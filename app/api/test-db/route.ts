import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { Store, Service, Product } from '@/lib/models'

export async function GET(request: NextRequest) {
  try {
    // Test MongoDB connection
    await connectToDatabase()
    
    // Count existing data
    const storeCount = await Store.countDocuments()
    const serviceCount = await Service.countDocuments()
    const productCount = await Product.countDocuments()
    
    return NextResponse.json({
      success: true,
      message: 'MongoDB connected successfully!',
      data: {
        stores: storeCount,
        services: serviceCount,
        products: productCount
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()
    
    // Create sample store
    const sampleStore = new Store({
      vendorId: 'sample-vendor-' + Date.now(),
      storeName: 'Tech Empire Sample Store',
      storeDescription: 'A sample electronics and gadgets store for testing MongoDB integration',
      storeImage: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=500',
      category: 'Electronics',
      rating: 4.5,
      reviewCount: 32,
      isOpen: true,
      deliveryTime: '30-45 mins',
      deliveryFee: 5.00,
      minimumOrder: 25.00,
      address: '123 Tech Street, Digital City'
    })
    
    const savedStore = await sampleStore.save()
    
    // Create sample service
    const sampleService = new Service({
      providerId: 'sample-provider-' + Date.now(),
      providerName: 'John Tech Expert',
      title: 'Website Development & Design',
      description: 'Professional website development using modern technologies like React, Next.js, and MongoDB',
      category: 'Web Development',
      price: 75.00,
      pricingType: 'hourly',
      duration: 60,
      images: ['https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500'],
      location: 'Online',
      locationType: 'online',
      availability: {
        monday: { start: '09:00', end: '17:00', available: true },
        tuesday: { start: '09:00', end: '17:00', available: true },
        wednesday: { start: '09:00', end: '17:00', available: true },
        thursday: { start: '09:00', end: '17:00', available: true },
        friday: { start: '09:00', end: '17:00', available: true }
      },
      rating: 4.8,
      reviewCount: 24,
      featured: true,
      status: 'active',
      tags: ['web-development', 'react', 'nextjs', 'mongodb']
    })
    
    const savedService = await sampleService.save()
    
    // Create sample product
    const sampleProduct = new Product({
      title: 'MacBook Pro M3 Max',
      description: 'Latest MacBook Pro with M3 Max chip, 32GB RAM, 1TB SSD. Perfect for developers and creative professionals.',
      price: 2499.99,
      category: 'Electronics',
      images: ['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500'],
      vendorId: savedStore.vendorId,
      vendorName: savedStore.storeName,
      stock: 5,
      featured: true,
      status: 'active'
    })
    
    const savedProduct = await sampleProduct.save()
    
    return NextResponse.json({
      success: true,
      message: 'Sample data created successfully!',
      data: {
        store: { id: savedStore._id, name: savedStore.storeName },
        service: { id: savedService._id, title: savedService.title },
        product: { id: savedProduct._id, title: savedProduct.title }
      }
    })
  } catch (error: any) {
    console.error('Sample data creation error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}