import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { BidListing } from '@/lib/models/BidListing'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: Params) {
  try {
    const { id } = await context.params
    const body = await request.json().catch(() => ({}))

    const bidderName = String(body?.bidderName || '').trim()
    const bidderEmail = String(body?.bidderEmail || '').trim().toLowerCase()
    const amount = Number(body?.amount)

    if (!bidderName || Number.isNaN(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Provide your name and a valid bid amount.' }, { status: 400 })
    }

    await connectToDatabase()
    const listing = await BidListing.findById(id)

    if (!listing) {
      return NextResponse.json({ success: false, error: 'Listing not found.' }, { status: 404 })
    }

    const now = new Date()
    if (listing.status !== 'live' || listing.endsAt <= now) {
      return NextResponse.json({ success: false, error: 'This auction is closed.' }, { status: 400 })
    }

    const minimumAllowed = Math.max(Number(listing.currentBid || listing.startPrice), Number(listing.startPrice)) + Number(listing.minIncrement || 0)
    if (amount < minimumAllowed) {
      return NextResponse.json({ success: false, error: `Minimum allowed bid is N${minimumAllowed.toLocaleString()}.` }, { status: 400 })
    }

    listing.currentBid = amount
    listing.bidCount = Number(listing.bidCount || 0) + 1
    listing.bids.push({
      amount,
      bidderName,
      bidderEmail: bidderEmail || undefined,
      createdAt: new Date(),
    })

    await listing.save()

    return NextResponse.json({
      success: true,
      listing: {
        _id: listing._id,
        currentBid: listing.currentBid,
        bidCount: listing.bidCount,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to place bid' }, { status: 500 })
  }
}
