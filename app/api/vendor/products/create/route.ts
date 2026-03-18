import { NextRequest, NextResponse } from 'next/server'
import { createProduct } from '@/lib/database'
import { cacheNamespaces, invalidateCacheNamespace } from '@/lib/cache-store'
import { logApiPerformance } from '@/lib/performance-logs'

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  let statusCode = 201

  try {
    const productData = await request.json()
    const newProduct = await createProduct(productData)

    await invalidateCacheNamespace(cacheNamespaces.productsList)
    await invalidateCacheNamespace(cacheNamespaces.productsDetail)

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