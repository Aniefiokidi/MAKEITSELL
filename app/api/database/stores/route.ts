import { NextRequest, NextResponse } from 'next/server'
import { getStores as mongoGetStores } from '@/lib/mongodb-operations'
import { getProducts } from '@/lib/mongodb-operations'

export async function GET(request: NextRequest) {
  try {
    console.log('Stores API called with params:', request.url)
    
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || undefined
    const isOpen = searchParams.get('isOpen') === 'true' ? true : undefined
    const limitCount = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined
    const vendorId = searchParams.get('vendorId') || undefined

    console.log('Filter parameters:', { category, isOpen, limitCount, vendorId })

    const stores = await mongoGetStores({
      category,
      isOpen,
      limitCount,
      vendorId
      // Note: Removed subscription filters to show all stores (including legacy ones)
      // Only suspended stores will be explicitly filtered out by the database query
    })

    console.log('MongoDB returned stores:', stores?.length || 0, 'stores')
    if (stores && stores.length > 0) {
      console.log('First store sample:', {
        id: stores[0]._id,
        name: stores[0].storeName,
        vendorId: stores[0].vendorId,
        subscriptionStatus: stores[0].subscriptionStatus,
        accountStatus: stores[0].accountStatus,
        isActive: stores[0].isActive
      })
    } else {
      console.log('No stores returned from database query')
    }

    // Only use real stores from the database
    const allStores = stores || [];
    // Map MongoDB store fields to UI expected fields and add product count
    const mappedStores = await Promise.all(allStores.map(async store => {
      // DEBUG: Log full store object to check for profileImage
      console.log('DEBUG: Raw store from DB:', JSON.stringify(store, null, 2));
      // Get products for this store
      const storeProducts = await getProducts({ vendorId: store.vendorId })
      const productCount = storeProducts?.length || 0
      
      // Get first product image
      const firstProductImage = storeProducts?.[0]?.images?.[0] || null

      return {
        ...store,
        id: store._id?.toString() || store.id,
        name: store.storeName,
        description: store.storeDescription,
        logoImage: store.storeImage || store.profileImage || store.logo,
        // Use profileImage as first choice for bannerImage
        bannerImage: store.profileImage || firstProductImage || store.bannerImages?.[0] || store.storeBanner || store.storeImage,
        productImages: firstProductImage ? [firstProductImage] : [],
        location: store.address,
        city: store.address?.split(',')[1]?.trim() || store.address,
        productCount: productCount
      }
    }))

    return NextResponse.json({ success: true, data: mappedStores })
  } catch (error: any) {
    console.error('Get stores error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch stores',
      data: []
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const storeData = await request.json()
    console.log('Creating store with data:', storeData)
    
    // Map the data from signup form to the MongoDB store schema
    const mappedStoreData = {
      vendorId: storeData.vendorId,
      storeName: storeData.storeName || storeData.name,
      storeDescription: storeData.storeDescription || storeData.description,
      storeImage: storeData.storeImage || storeData.logoImage || '',
      profileImage: storeData.profileImage || '',
      storeBanner: storeData.bannerImage,
      category: storeData.category || storeData.storeCategory,
      reviewCount: storeData.reviewCount || 0,
      isOpen: storeData.isOpen !== undefined ? storeData.isOpen : true,
      deliveryTime: storeData.deliveryTime || "30-60 min",
      deliveryFee: storeData.deliveryFee || 500,
      minimumOrder: storeData.minimumOrder || 2000,
      address: storeData.address || storeData.location || '',
      phone: storeData.phone || storeData.storePhone,
      email: storeData.email
    }

    console.log('Mapped store data:', mappedStoreData)

    // Validate required fields
    const requiredFields = ['vendorId', 'storeName', 'storeDescription', 'storeImage', 'category', 'deliveryTime', 'address']
    const missingFields = requiredFields.filter(field => !mappedStoreData[field as keyof typeof mappedStoreData])
    
    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields)
      return NextResponse.json({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`
      }, { status: 400 })
    }

    // Create store in MongoDB
    const { createStore } = await import('@/lib/mongodb-operations')
    const storeId = await createStore(mappedStoreData)
    
    console.log('Store created successfully with ID:', storeId)
    return NextResponse.json({ success: true, id: storeId })
  } catch (error: any) {
    console.error('Create store error:', error)
    return NextResponse.json({
      success: false,
      error: `Failed to create store: ${error.message}`
    }, { status: 500 })
  }
}