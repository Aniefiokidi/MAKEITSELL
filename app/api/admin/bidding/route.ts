import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { requireAdminAccess, getSessionUserFromRequest } from '@/lib/server-route-auth'
import { BidListing } from '@/lib/models/BidListing'
import { settleExpiredBiddingListings } from '@/lib/bidding-settlement'

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    await connectToDatabase()
    await settleExpiredBiddingListings()
    const listings = await BidListing.find({}).sort({ createdAt: -1 }).lean()
    return NextResponse.json({ success: true, listings })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to load bidding listings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    const body = await request.json().catch(() => ({}))
    const title = String(body?.title || '').trim()
    const description = String(body?.description || '').trim()
    const imageUrl = String(body?.imageUrl || '').trim()
    const category = String(body?.category || '').trim()
    const location = String(body?.location || '').trim()
    const status = String(body?.status || 'live').trim()
    const startPrice = Number(body?.startPrice)
    const minIncrement = Math.max(Number(body?.minIncrement) || 1000, 1)
    const reservePrice = body?.reservePrice === '' || body?.reservePrice == null ? undefined : Number(body?.reservePrice)
    const endsAt = new Date(body?.endsAt)

    if (!title || !description || Number.isNaN(startPrice) || startPrice <= 0 || Number.isNaN(endsAt.getTime())) {
      return NextResponse.json({ success: false, error: 'Provide valid title, description, starting price, and end date.' }, { status: 400 })
    }

    if (!['draft', 'live', 'closed'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status value.' }, { status: 400 })
    }

    await connectToDatabase()
    const sessionUser = await getSessionUserFromRequest(request)

    const listing = await BidListing.create({
      title,
      description,
      imageUrl: imageUrl || undefined,
      category: category || undefined,
      location: location || undefined,
      startPrice,
      currentBid: startPrice,
      minIncrement,
      reservePrice,
      endsAt,
      status,
      createdBy: sessionUser?.id,
    })

    return NextResponse.json({ success: true, listing }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to create bidding listing' }, { status: 500 })
  }
}
