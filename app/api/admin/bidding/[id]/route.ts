import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { requireAdminAccess } from '@/lib/server-route-auth'
import { BidListing } from '@/lib/models/BidListing'
import { releaseHighestBidderHold } from '@/lib/bidding-settlement'

type Params = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, context: Params) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const patch: Record<string, any> = {}

    if (typeof body?.status === 'string' && ['draft', 'live', 'closed'].includes(body.status)) {
      patch.status = body.status
    }
    if (typeof body?.featured === 'boolean') {
      patch.featured = body.featured
    }
    if (body?.endsAt) {
      const parsedEnd = new Date(body.endsAt)
      if (!Number.isNaN(parsedEnd.getTime())) {
        patch.endsAt = parsedEnd
      }
    }

    await connectToDatabase()

    // An admin manually closing a still-unsettled listing (as opposed to it naturally
    // expiring — that path is settleExpiredBiddingListings, untouched here) means
    // "cancel this," not "sell it" — there's no UI for the admin to actually award it
    // to the current highest bidder. Previously this just flipped `status` and left the
    // hold in place, and the *next* settlement pass would silently charge that bidder
    // for a listing the admin thought they'd cancelled. Refund and mark settled instead.
    if (patch.status === 'closed') {
      const existing = await BidListing.findById(id)
      if (!existing) {
        return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 })
      }
      if (existing.settlementStatus === 'pending') {
        await releaseHighestBidderHold(existing, 'listing cancelled by admin')
        patch.settlementStatus = 'settled'
        patch.winnerUserId = undefined
        patch.winnerName = undefined
        patch.winningBidAmount = 0
        patch.settledAt = new Date()
        patch.settlementFailureReason = 'Cancelled by admin'
      }
    }

    const listing = await BidListing.findByIdAndUpdate(id, { $set: patch }, { new: true })
    if (!listing) {
      return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, listing })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to update listing' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: Params) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    const { id } = await context.params
    await connectToDatabase()

    const listing = await BidListing.findById(id)
    if (!listing) {
      return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 })
    }

    // Same gap as the PUT-to-closed case above: deleting the document previously just
    // discarded any held bid security along with it instead of returning it.
    if (listing.settlementStatus === 'pending') {
      await releaseHighestBidderHold(listing, 'listing deleted by admin')
    }

    await BidListing.findByIdAndDelete(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to delete listing' }, { status: 500 })
  }
}
