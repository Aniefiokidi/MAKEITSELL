import { NextRequest, NextResponse } from 'next/server'
import { createProduct } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const productData = await request.json()
    const newProduct = await createProduct(productData)

    return NextResponse.json({ product: newProduct }, { status: 201 })
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}