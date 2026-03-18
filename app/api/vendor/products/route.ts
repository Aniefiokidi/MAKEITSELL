import { NextRequest, NextResponse } from 'next/server'
import { getProducts, deleteProduct } from '@/lib/mongodb-operations'
import { cacheNamespaces, invalidateCacheNamespace } from '@/lib/cache-store'
import { logApiPerformance } from '@/lib/performance-logs'

export async function GET(request: NextRequest) {
  const startedAt = Date.now()
  let statusCode = 200

  try {
    const { searchParams } = new URL(request.url)
    const vendorId = searchParams.get('vendorId')
    const search = searchParams.get('search')

    if (!vendorId) {
      statusCode = 400
      return NextResponse.json({ error: 'Vendor ID is required' }, { status: 400 })
    }

    let products = await getProducts({ vendorId })

    // Apply search filter if provided
    if (search) {
      const searchTerm = search.toLowerCase()
      products = products.filter((product: any) =>
        product.name?.toLowerCase().includes(searchTerm) ||
        product.description?.toLowerCase().includes(searchTerm) ||
        product.category?.toLowerCase().includes(searchTerm)
      )
    }

    return NextResponse.json({ products })
  } catch (error) {
    console.error('Error fetching vendor products:', error)
    statusCode = 500
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  } finally {
    void logApiPerformance({
      route: '/api/vendor/products',
      method: request.method,
      statusCode,
      durationMs: Date.now() - startedAt,
      cacheHit: false,
    })
  }
}

export async function DELETE(request: NextRequest) {
  const startedAt = Date.now()
  let statusCode = 200

  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    if (!productId) {
      statusCode = 400
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    await deleteProduct(productId)
    await invalidateCacheNamespace(cacheNamespaces.productsList)
    await invalidateCacheNamespace(cacheNamespaces.productsDetail)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting product:', error)
    statusCode = 500
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
  } finally {
    void logApiPerformance({
      route: '/api/vendor/products',
      method: request.method,
      statusCode,
      durationMs: Date.now() - startedAt,
      cacheHit: false,
    })
  }
}