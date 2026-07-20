import { NextRequest, NextResponse } from 'next/server'
import { getProductById, updateProduct, deleteProduct } from '@/lib/mongodb-operations'
import { cacheNamespaces, invalidateCacheNamespace } from '@/lib/cache-store'
import { logApiPerformance } from '@/lib/performance-logs'
import { syncStreakFloor } from '@/lib/streak/calculateFloor'
import { requireRoles } from '@/lib/server-route-auth'
import { checkWishlistPriceDrops } from '@/lib/wishlist-price-alerts'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now()
  let statusCode = 200

  try {
    const { id } = await params
    const product = await getProductById(id)
    
    if (!product) {
      statusCode = 404
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json({ product })
  } catch (error) {
    console.error('Error fetching product:', error)
    statusCode = 500
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 })
  } finally {
    void logApiPerformance({
      route: '/api/vendor/products/[id]',
      method: request.method,
      statusCode,
      durationMs: Date.now() - startedAt,
      cacheHit: false,
    })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now()
  let statusCode = 200

  const { user, response } = await requireRoles(request, ['vendor', 'admin'])
  if (response) {
    statusCode = response.status
    void logApiPerformance({
      route: '/api/vendor/products/[id]',
      method: request.method,
      statusCode,
      durationMs: Date.now() - startedAt,
      cacheHit: false,
    })
    return response
  }

  try {
    const { id } = await params
    const existingProduct = await getProductById(id)
    if (!existingProduct) {
      statusCode = 404
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    if (user?.role === 'vendor' && String((existingProduct as any).vendorId) !== user.id) {
      statusCode = 403
      return NextResponse.json({ error: 'You do not have permission to edit this product' }, { status: 403 })
    }

    const productData = await request.json()
    if (user?.role === 'vendor') delete (productData as any).vendorId
    const updatedProduct = await updateProduct(id, productData)

    await invalidateCacheNamespace(cacheNamespaces.productsList)
    await invalidateCacheNamespace(cacheNamespaces.productsDetail)

    // A price cut (or reactivating a cheap product) can lower this vendor's lowest active
    // price — re-sync so a locked streak floor can't go stale against it.
    const vendorId = String((updatedProduct as any)?.vendorId || '')
    if (vendorId) {
      void syncStreakFloor(vendorId).catch(() => {
        // Floor recalculation is best-effort; never break the product update
      })
    }

    const oldPrice = Number((existingProduct as any).price || 0)
    const newPrice = Number((updatedProduct as any)?.price || 0)
    if (newPrice > 0 && newPrice < oldPrice) {
      void checkWishlistPriceDrops(id, newPrice, (updatedProduct as any)?.title || (updatedProduct as any)?.name)
    }

    return NextResponse.json({ product: updatedProduct })
  } catch (error) {
    console.error('Error updating product:', error)
    statusCode = 500
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  } finally {
    void logApiPerformance({
      route: '/api/vendor/products/[id]',
      method: request.method,
      statusCode,
      durationMs: Date.now() - startedAt,
      cacheHit: false,
    })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now()
  let statusCode = 200

  const { user, response } = await requireRoles(request, ['vendor', 'admin'])
  if (response) {
    statusCode = response.status
    void logApiPerformance({
      route: '/api/vendor/products/[id]',
      method: request.method,
      statusCode,
      durationMs: Date.now() - startedAt,
      cacheHit: false,
    })
    return response
  }

  try {
    const { id } = await params
    const existingProduct = await getProductById(id)
    if (!existingProduct) {
      statusCode = 404
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    if (user?.role === 'vendor' && String((existingProduct as any).vendorId) !== user.id) {
      statusCode = 403
      return NextResponse.json({ error: 'You do not have permission to delete this product' }, { status: 403 })
    }

    await deleteProduct(id)

    await invalidateCacheNamespace(cacheNamespaces.productsList)
    await invalidateCacheNamespace(cacheNamespaces.productsDetail)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting product:', error)
    statusCode = 500
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
  } finally {
    void logApiPerformance({
      route: '/api/vendor/products/[id]',
      method: request.method,
      statusCode,
      durationMs: Date.now() - startedAt,
      cacheHit: false,
    })
  }
}