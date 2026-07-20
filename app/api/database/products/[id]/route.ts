import { NextRequest, NextResponse } from "next/server"
import { getProductById, updateProduct } from "@/lib/mongodb-operations"
import { cacheNamespaces, getCachedPayload, invalidateCacheNamespace, setCachedPayload } from '@/lib/cache-store'
import { logApiPerformance } from '@/lib/performance-logs'
import { requireRoles } from '@/lib/server-route-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now()
  let statusCode = 200
  let cacheHit = false

  try {
    const { id } = await params

    if (!id) {
      statusCode = 400
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      )
    }

    const cacheKey = JSON.stringify({ id })
    const cached = await getCachedPayload<any>(cacheNamespaces.productsDetail, cacheKey)
    if (cached) {
      cacheHit = true
      statusCode = 200
      return NextResponse.json(cached)
    }

    const product = await getProductById(id)

    if (!product) {
      statusCode = 404
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    const payload = {
      success: true,
      data: product
    }

    await setCachedPayload(cacheNamespaces.productsDetail, cacheKey, payload, 120)

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Get product API error:', error)
    statusCode = 500
    return NextResponse.json(
      { success: false, error: 'Failed to fetch product' },
      { status: 500 }
    )
  } finally {
    void logApiPerformance({
      route: '/api/database/products/[id]',
      method: request.method,
      statusCode,
      durationMs: Date.now() - startedAt,
      cacheHit,
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
      route: '/api/database/products/[id]',
      method: request.method,
      statusCode,
      durationMs: Date.now() - startedAt,
      cacheHit: false,
    })
    return response
  }

  try {
    const { id } = await params
    const updateData = await request.json()

    if (!id) {
      statusCode = 400
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      )
    }

    const existingProduct = await getProductById(id)
    if (!existingProduct) {
      statusCode = 404
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    if (user?.role === 'vendor' && String((existingProduct as any).vendorId) !== user.id) {
      statusCode = 403
      return NextResponse.json(
        { success: false, error: 'You do not have permission to edit this product' },
        { status: 403 }
      )
    }

    // A vendor can't reassign their product to another vendor by slipping vendorId into the body.
    if (user?.role === 'vendor') {
      delete (updateData as any).vendorId
    }

    const updatedProduct = await updateProduct(id, updateData)

    if (!updatedProduct) {
      statusCode = 404
      return NextResponse.json(
        { success: false, error: 'Product not found or update failed' },
        { status: 404 }
      )
    }

    await invalidateCacheNamespace(cacheNamespaces.productsList)
    await invalidateCacheNamespace(cacheNamespaces.productsDetail)

    return NextResponse.json({
      success: true,
      data: updatedProduct,
      message: 'Product updated successfully'
    })
  } catch (error: any) {
    console.error('Update product API error:', error)
    statusCode = 500
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update product' },
      { status: 500 }
    )
  } finally {
    void logApiPerformance({
      route: '/api/database/products/[id]',
      method: request.method,
      statusCode,
      durationMs: Date.now() - startedAt,
      cacheHit: false,
    })
  }
}