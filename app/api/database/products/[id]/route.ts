import { NextRequest, NextResponse } from "next/server"
import { getProductById, updateProduct } from "@/lib/mongodb-operations"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      )
    }

    const product = await getProductById(id)

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: product
    })
  } catch (error) {
    console.error('Get product API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch product' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const updateData = await request.json()

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      )
    }

    const updatedProduct = await updateProduct(id, updateData)

    if (!updatedProduct) {
      return NextResponse.json(
        { success: false, error: 'Product not found or update failed' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: updatedProduct,
      message: 'Product updated successfully'
    })
  } catch (error: any) {
    console.error('Update product API error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update product' },
      { status: 500 }
    )
  }
}