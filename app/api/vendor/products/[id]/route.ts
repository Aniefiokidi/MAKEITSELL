import { NextRequest, NextResponse } from 'next/server'
import { getProductById, updateProduct, deleteProduct } from '@/lib/mongodb-operations'
import { cacheNamespaces, invalidateCacheNamespace } from '@/lib/cache-store'
import { logApiPerformance } from '@/lib/performance-logs'

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

  try {
    const { id } = await params
    const productData = await request.json()
    const updatedProduct = await updateProduct(id, productData)

    await invalidateCacheNamespace(cacheNamespaces.productsList)
    await invalidateCacheNamespace(cacheNamespaces.productsDetail)

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

  try {
    const { id } = await params
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