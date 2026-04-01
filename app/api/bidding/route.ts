import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { BidListing } from '@/lib/models/BidListing'

export async function GET(request: NextRequest) {
  try {
    const status = (request.nextUrl.searchParams.get('status') || 'live').toLowerCase()

    await connectToDatabase()

    const now = new Date()
    const query: Record<string, any> = {}

    if (status === 'all') {
      query.status = { $in: ['live', 'closed', 'draft'] }
    } else if (status === 'closed') {
      query.$or = [{ status: 'closed' }, { endsAt: { $lte: now } }]
    } else {
      query.status = 'live'
      query.endsAt = { $gt: now }
    }

    const listings = await BidListing.find(query)
      .sort({ featured: -1, endsAt: 1, createdAt: -1 })
      .select('-bids.bidderEmail')
      .lean()

    return NextResponse.json({ success: true, listings })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to load bidding listings' }, { status: 500 })
  }
}
