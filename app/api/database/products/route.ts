import { NextRequest, NextResponse } from "next/server"
import { getProducts, createProduct, countProducts } from "@/lib/mongodb-operations"
import { requireRoles } from '@/lib/server-route-auth'
import { cacheNamespaces, getCachedPayload, invalidateCacheNamespace, setCachedPayload } from '@/lib/cache-store'
import { logApiPerformance } from '@/lib/performance-logs'

export async function GET(request: NextRequest) {
  const startedAt = Date.now()
  let statusCode = 200
  let cacheHit = false

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const category = searchParams.get('category')
    const vendorId = searchParams.get('vendorId')
    const featured = searchParams.get('featured')
    const search = searchParams.get('search') || undefined
    const limit = searchParams.get('limit')
    const page = searchParams.get('page')
    const sortBy = searchParams.get('sortBy') || undefined
    const minPrice = searchParams.get('minPrice')
    const maxPrice = searchParams.get('maxPrice')

    const parsedLimit = Number.parseInt(limit || '24', 10)
    const safeLimit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 24
    const parsedPage = Number.parseInt(page || '1', 10)
    const safePage = Number.isFinite(parsedPage) ? Math.max(parsedPage, 1) : 1
    const skipCount = (safePage - 1) * safeLimit

    if (id) {
      const detailCacheKey = JSON.stringify({ id })
      const cachedDetail = await getCachedPayload<{ success: boolean; data: any[] }>(cacheNamespaces.productsDetail, detailCacheKey)
      if (cachedDetail) {
        cacheHit = true
        statusCode = 200
        return NextResponse.json(cachedDetail, {
          headers: {
            'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600'
          }
        })
      }

      // Fetch single product by id
      const product = await (await import('@/lib/mongodb-operations')).getProductById(id)
      if (!product) {
        statusCode = 404
        return NextResponse.json({ success: false, error: 'Product not found', data: [] }, { status: 404 })
      }

      const payload = { success: true, data: [product] }
      await setCachedPayload(cacheNamespaces.productsDetail, detailCacheKey, payload, 120)

      return NextResponse.json(
        payload,
        {
          headers: {
            'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600'
          }
        }
      )
    }

    const filters: any = {}
    if (category) filters.category = category
    if (vendorId) filters.vendorId = vendorId
    if (featured) filters.featured = featured === 'true'
    if (search) filters.search = search
    if (sortBy) filters.sortBy = sortBy
    if (minPrice !== null) filters.minPrice = Number(minPrice)
    if (maxPrice !== null) filters.maxPrice = Number(maxPrice)
    filters.limitCount = safeLimit
    filters.skipCount = skipCount

    const listCacheKey = JSON.stringify({
      category: category || null,
      vendorId: vendorId || null,
      featured: typeof featured === 'string' ? featured : null,
      search: search || null,
      sortBy: sortBy || null,
      minPrice: minPrice !== null ? Number(minPrice) : null,
      maxPrice: maxPrice !== null ? Number(maxPrice) : null,
      page: safePage,
      limit: safeLimit,
    })

    const cachedList = await getCachedPayload<any>(cacheNamespaces.productsList, listCacheKey)
    if (cachedList) {
      cacheHit = true
      statusCode = 200
      return NextResponse.json(
        cachedList,
        !vendorId
          ? { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
          : undefined
      )
    }

    const [products, total] = await Promise.all([
      getProducts(filters),
      countProducts(filters),
    ])
    const mappedProducts = products?.map((product: any) => ({
      ...product,
      id: product?._id?.toString?.() || product?.id
    })) || []

    const isPublicCollectionRequest = !vendorId
    const payload = {
      success: true,
      data: mappedProducts,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
        count: mappedProducts.length,
        hasMore: mappedProducts.length === safeLimit
      }
    }

    await setCachedPayload(cacheNamespaces.productsList, listCacheKey, payload, 60)

    return NextResponse.json(
      payload,
      isPublicCollectionRequest
        ? { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
        : undefined
    )
  } catch (error) {
    console.error('Products API error:', error)
    statusCode = 500
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    )
  } finally {
    void logApiPerformance({
      route: '/api/database/products',
      method: request.method,
      statusCode,
      durationMs: Date.now() - startedAt,
      cacheHit,
    })
  }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  let statusCode = 200

  const { user, response } = await requireRoles(request, ['vendor', 'admin'])
  if (response) {
    statusCode = response.status
    void logApiPerformance({
      route: '/api/database/products',
      method: request.method,
      statusCode,
      durationMs: Date.now() - startedAt,
      cacheHit: false,
    })
    return response
  }

  try {
    const productData = await request.json()
    // Prevent privilege escalation by enforcing vendor ownership from the session.
    if (user?.role === 'vendor') {
      productData.vendorId = user.id
    }

    // Auto-populate storeId if vendorId is provided
    if (productData.vendorId && !productData.storeId) {
      try {
        const { getStoreByVendorId } = await import('@/lib/mongodb-operations')
        const store = await getStoreByVendorId(productData.vendorId)
        if (store) {
          productData.storeId = store._id.toString()
          console.log('Auto-populated storeId:', productData.storeId)
        }
      } catch (storeError) {
        console.warn('Could not auto-populate storeId:', storeError)
      }
    }

    const productId = await createProduct(productData)

    await invalidateCacheNamespace(cacheNamespaces.productsList)
    await invalidateCacheNamespace(cacheNamespaces.productsDetail)

    return NextResponse.json({
      success: true,
      id: productId,
      message: 'Product created successfully'
    })
  } catch (error: any) {
    console.error('Create product error:', error)
    statusCode = 500
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create product' },
      { status: 500 }
    )
  } finally {
    void logApiPerformance({
      route: '/api/database/products',
      method: request.method,
      statusCode,
      durationMs: Date.now() - startedAt,
      cacheHit: false,
    })
  }
}