import { NextRequest, NextResponse } from "next/server"
import { getProducts, createProduct } from "@/lib/mongodb-operations"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const vendorId = searchParams.get('vendorId')
    const featured = searchParams.get('featured')
    const limit = searchParams.get('limit')

    const filters: any = {}
    
    if (category) filters.category = category
    if (vendorId) filters.vendorId = vendorId
    if (featured) filters.featured = featured === 'true'
    if (limit) filters.limitCount = parseInt(limit)

    const products = await getProducts(filters)

    // Map MongoDB product fields to UI expected fields
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
  try {
    const productData = await request.json()
    console.log('Creating product with data:', productData)

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