import { NextRequest, NextResponse } from 'next/server'
import { createProduct } from '@/lib/mongodb-operations'
import { cacheNamespaces, invalidateCacheNamespace } from '@/lib/cache-store'
import { logApiPerformance } from '@/lib/performance-logs'
import { syncStreakFloor } from '@/lib/streak/calculateFloor'
import { requireRoles } from '@/lib/server-route-auth'

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  let statusCode = 201

  const { user, response } = await requireRoles(request, ['vendor', 'admin'])
  if (response) {
    statusCode = response.status
    void logApiPerformance({
      route: '/api/vendor/products/create',
      method: request.method,
      statusCode,
      durationMs: Date.now() - startedAt,
      cacheHit: false,
    })
    return response
  }

  try {
    const productData = await request.json()
    // Prevent a vendor from attributing a new product to a different vendor.
    if (user?.role === 'vendor') {
      productData.vendorId = user.id
    }
    const newProduct = await createProduct(productData)

    await invalidateCacheNamespace(cacheNamespaces.productsList)
    await invalidateCacheNamespace(cacheNamespaces.productsDetail)

    // After creating a product, re-sync the streak floor — converts the default 26-order
    // floor to a real one based on actual prices, and ratchets an already-real floor up
    // if this new product is cheaper than the vendor's previous lowest.
    const vendorId = String(productData?.vendorId || '')
    if (vendorId) {
      void syncStreakFloor(vendorId).catch(() => {
        // Floor recalculation is best-effort; never break product creation
      })
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