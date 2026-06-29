import { NextRequest, NextResponse } from 'next/server'
import { createProduct } from '@/lib/mongodb-operations'
import { cacheNamespaces, invalidateCacheNamespace } from '@/lib/cache-store'
import { logApiPerformance } from '@/lib/performance-logs'
import connectToDatabase from '@/lib/mongodb'
import { VendorStreak } from '@/lib/models/VendorStreak'
import { calculateStreakFloor } from '@/lib/streak/calculateFloor'

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  let statusCode = 201

  try {
    const productData = await request.json()
    const newProduct = await createProduct(productData)

    await invalidateCacheNamespace(cacheNamespaces.productsList)
    await invalidateCacheNamespace(cacheNamespaces.productsDetail)

    // After creating a product, recalculate streak floor if vendor still has the default floor.
    // This converts the default 26-order floor to the real floor based on actual product prices.
    const vendorId = String(newProduct?.vendorId || productData?.vendorId || '')
    if (vendorId) {
      void (async () => {
        try {
          await connectToDatabase()
          const streakDoc = await VendorStreak.findOne({ vendorId }).lean() as any
          if (!streakDoc?.isDefaultFloor) return

          const floor = await calculateStreakFloor(vendorId)
          if (floor.isDefaultFloor) return

          const needsTargetReview = streakDoc.hasSetTarget && streakDoc.targetOrderCount < floor.floorOrderCount
          await VendorStreak.updateOne(
            { vendorId },
            {
              $set: {
                floorOrderCount: floor.floorOrderCount,
                lowestProductPriceAtLock: floor.lowestPrice,
                isDefaultFloor: false,
                ...(needsTargetReview ? { needsTargetReview: true } : {}),
                updatedAt: new Date(),
              },
            }
          )
        } catch {
          // Floor recalculation is best-effort; never break product creation
        }
      })()
    }

    return NextResponse.json({ product: newProduct }, { status: 201 })
  } catch (error) {
    console.error('Error creating product:', error)
    statusCode = 500
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  } finally {
    void logApiPerformance({
      route: '/api/vendor/products/create',
      method: request.method,
      statusCode,
      durationMs: Date.now() - startedAt,
      cacheHit: false,
    })
  }
}