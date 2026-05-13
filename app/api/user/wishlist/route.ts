import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Wishlist } from '@/lib/models/Wishlist'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'

export async function GET(request: NextRequest) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser) {
    return NextResponse.json({ success: false, items: [] })
  }
  await connectToDatabase()
  const wishlist = await Wishlist.findOne({ userId: sessionUser.id }).lean()
  return NextResponse.json({ success: true, items: (wishlist as any)?.items || [] })
}

export async function POST(request: NextRequest) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json()
  const { productId, title, price, image, vendorId, category } = body
  if (!productId) {
    return NextResponse.json({ success: false, error: 'productId required' }, { status: 400 })
  }
  await connectToDatabase()
  // Use $addToSet won't work for subdocuments — pull first then push to avoid duplicates
  await Wishlist.updateOne(
    { userId: sessionUser.id },
    { $pull: { items: { productId } } },
    { upsert: true }
  )
  await Wishlist.updateOne(
    { userId: sessionUser.id },
    {
      $push: {
        items: {
          $each: [{ productId, title: title || '', price: price || 0, image: image || '', vendorId: vendorId || '', category: category || '', addedAt: new Date() }],
          $position: 0,
        },
      },
    },
    { upsert: true }
  )
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const productId = searchParams.get('productId')
  if (!productId) {
    return NextResponse.json({ success: false, error: 'productId required' }, { status: 400 })
  }
  await connectToDatabase()
  await Wishlist.updateOne(
    { userId: sessionUser.id },
    { $pull: { items: { productId } } }
  )
  return NextResponse.json({ success: true })
}
