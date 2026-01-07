import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()
    const db = require('mongoose').connection.db
    
    // Find all stores
    const stores = await db.collection('stores').find({}).toArray()
    console.log(`Found ${stores.length} stores to check`)
    
    let updatedCount = 0
    const updates: any[] = []
    
    for (const store of stores) {
      const storeUpdates: any = {}
      
      // Fix missing logoImage - use storeImage if available
      if (!store.logoImage && store.storeImage) {
        storeUpdates.logoImage = store.storeImage
      }
      
      // Fix missing location field - use address if available
      if (!store.location && store.address) {
        storeUpdates.location = store.address
      }
      
      // Fix missing city - try to extract from address or location
      if (!store.city) {
        const addressText = store.address || store.location || ''
        // Try to extract city (usually first part before comma)
        const cityMatch = addressText.split(',')[0]
        if (cityMatch) {
          storeUpdates.city = cityMatch.trim()
        } else {
          storeUpdates.city = 'Lagos' // Default
        }
      }
      
      // Ensure productCount exists
      if (store.productCount === undefined || store.productCount === null) {
        storeUpdates.productCount = 0
      }
      
      // Ensure rating and reviewCount exist
      if (store.rating === undefined || store.rating === null) {
        storeUpdates.rating = 0
      }
      if (store.reviewCount === undefined || store.reviewCount === null) {
        storeUpdates.reviewCount = 0
      }
      
      // Ensure isOpen exists
      if (store.isOpen === undefined || store.isOpen === null) {
        storeUpdates.isOpen = true
      }
      
      // Update if there are any changes
      if (Object.keys(storeUpdates).length > 0) {
        await db.collection('stores').updateOne(
          { _id: store._id },
          { $set: storeUpdates }
        )
        updatedCount++
        updates.push({
          storeId: store._id.toString(),
          storeName: store.storeName || store.name,
          appliedUpdates: storeUpdates
        })
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Fixed ${updatedCount} stores`,
      totalStores: stores.length,
      updatedStores: updatedCount,
      alreadyCorrect: stores.length - updatedCount,
      details: updates
    })
    
  } catch (error: any) {
    console.error('Error fixing stores:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
