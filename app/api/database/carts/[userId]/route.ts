import { NextRequest, NextResponse } from 'next/server'
import { getUserCart, setUserCart } from '@/lib/database'

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      )
    }

    const cart = await getUserCart(userId)
    
    return NextResponse.json({
      success: true,
      data: cart
    })
  } catch (error) {
    console.error('Error fetching cart:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch cart' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params
    const body = await request.json()
    const { items } = body

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      )
    }

    if (!Array.isArray(items)) {
      return NextResponse.json(
        { success: false, error: 'Items must be an array' },
        { status: 400 }
      )
    }

    await setUserCart(userId, items)
    
    return NextResponse.json({
      success: true,
      message: 'Cart updated successfully'
    })
  } catch (error) {
    console.error('Error updating cart:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update cart' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params
    const body = await request.json()
    await setUserCart(userId, body.items || [])
    return NextResponse.json({ success: true, message: 'Cart updated successfully' })
  } catch (error) {
    console.error('Error updating cart:', error)
    return NextResponse.json({ success: false, error: 'Failed to update cart' }, { status: 500 })
  }
}