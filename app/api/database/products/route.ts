import { NextRequest, NextResponse } from "next/server"
import { getProducts, createProduct } from "@/lib/mongodb-operations"
import { requireRoles } from '@/lib/server-route-auth'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const category = searchParams.get('category')
    const vendorId = searchParams.get('vendorId')
    const featured = searchParams.get('featured')
    const limit = searchParams.get('limit')

    if (id) {
      // Fetch single product by id
      const product = await (await import('@/lib/mongodb-operations')).getProductById(id)
      if (!product) {
        return NextResponse.json({ success: false, error: 'Product not found', data: [] }, { status: 404 })
      }
      return NextResponse.json({ success: true, data: [product] })
    }

    const filters: any = {}
    if (category) filters.category = category
    if (vendorId) filters.vendorId = vendorId
    if (featured) filters.featured = featured === 'true'
    if (limit) filters.limitCount = parseInt(limit)

    const products = await getProducts(filters)
    const mappedProducts = products?.map(product => ({
      ...product,
      id: product._id?.toString() || product.id
    })) || []

    return NextResponse.json({
      success: true,
      data: mappedProducts
    })
  } catch (error) {
    console.error('Products API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireRoles(request, ['vendor', 'admin'])
  if (response) return response

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

    return NextResponse.json({
      success: true,
      id: productId,
      message: 'Product created successfully'
    })
  } catch (error: any) {
    console.error('Create product error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create product' },
      { status: 500 }
    )
  }
}