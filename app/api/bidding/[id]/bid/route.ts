import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { BidListing } from '@/lib/models/BidListing'
import { User } from '@/lib/models/User'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'

type Params = { params: Promise<{ id: string }> }

const BID_HOLD_MIN_NAIRA = 5000

function computeRequiredHold(amount: number): number {
  return Math.max(Math.ceil(amount), BID_HOLD_MIN_NAIRA)
}

export async function POST(request: NextRequest, context: Params) {
  try {
    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json(
        { success: false, error: 'Please sign in to place a bid.' },
        { status: 401 }
      )
    }

    const { id } = await context.params
    const body = await request.json().catch(() => ({}))

    const bidderName = String(sessionUser?.name || '').trim() || 'Bidder'
    const bidderEmail = String(sessionUser?.email || '').trim().toLowerCase()
    const amount = Number(body?.amount)

    if (Number.isNaN(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Provide a valid bid amount.' }, { status: 400 })
    }

    await connectToDatabase()
    const bidder = await User.findById(sessionUser.id).select('_id walletBalance role name email').lean()
    if (!bidder) {
      return NextResponse.json({ success: false, error: 'Bidder account not found.' }, { status: 404 })
    }

    if (String((bidder as any)?.role || '').toLowerCase() === 'admin') {
      return NextResponse.json({ success: false, error: 'Admin accounts cannot place bids.' }, { status: 403 })
    }

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

    const bidderId = String((bidder as any)?._id || '')
    const requiredHold = computeRequiredHold(amount)
    const previousHighestBidderId = String((listing as any)?.highestBidderId || '')
    const previousHighestHold = Number((listing as any)?.highestBidHoldAmount || 0)
    const isSameHighestBidder = previousHighestBidderId && previousHighestBidderId === bidderId

    const additionalHoldNeeded = isSameHighestBidder
      ? Math.max(0, requiredHold - previousHighestHold)
      : requiredHold

    if (additionalHoldNeeded > 0) {
      const debitResult = await User.updateOne(
        { _id: bidderId, walletBalance: { $gte: additionalHoldNeeded } },
        { $inc: { walletBalance: -additionalHoldNeeded }, $set: { updatedAt: new Date() } }
      )

      if (debitResult.modifiedCount === 0) {
        const balance = Number((bidder as any)?.walletBalance || 0)
        return NextResponse.json(
          {
            success: false,
            error: `Insufficient wallet balance for bid security hold. Required: N${additionalHoldNeeded.toLocaleString()}, available: N${balance.toLocaleString()}.`,
            requiredHold,
            additionalHoldNeeded,
          },
          { status: 402 }
        )
      }

      await WalletTransaction.create({
        userId: bidderId,
        type: 'bid_security_hold',
        amount: additionalHoldNeeded,
        status: 'completed',
        reference: `bid_hold_${String(listing._id)}_${bidderId}_${Date.now()}`,
        provider: 'internal_wallet',
        note: `Bid security hold for ${listing.title}`,
        metadata: {
          listingId: String(listing._id),
          bidAmount: amount,
          requiredHold,
          additionalHoldNeeded,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    if (!isSameHighestBidder && previousHighestBidderId && previousHighestHold > 0) {
      const releaseResult = await User.updateOne(
        { _id: previousHighestBidderId },
        { $inc: { walletBalance: previousHighestHold }, $set: { updatedAt: new Date() } }
      )

      if (releaseResult.modifiedCount > 0) {
        await WalletTransaction.create({
          userId: previousHighestBidderId,
          type: 'bid_security_release',
          amount: previousHighestHold,
          status: 'completed',
          reference: `bid_release_${String(listing._id)}_${previousHighestBidderId}_${Date.now()}`,
          provider: 'internal_wallet',
          note: `Bid security hold released after being outbid on ${listing.title}`,
          metadata: {
            listingId: String(listing._id),
            outbidByUserId: bidderId,
            outbidAmount: amount,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }
    }

    listing.currentBid = amount
    listing.bidCount = Number(listing.bidCount || 0) + 1
    ;(listing as any).highestBidderId = bidderId
    ;(listing as any).highestBidderName = bidderName
    ;(listing as any).highestBidHoldAmount = requiredHold
    ;(listing as any).settlementStatus = 'pending'
    ;(listing as any).winnerUserId = undefined
    ;(listing as any).winnerName = undefined
    ;(listing as any).winningBidAmount = undefined
    ;(listing as any).settledAt = undefined
    ;(listing as any).settlementFailureReason = undefined
    listing.bids.push({
      amount,
      bidderId,
      bidderName,
      bidderEmail: bidderEmail || undefined,
      holdAmount: requiredHold,
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
      hold: {
        requiredHold,
        additionalHoldNeeded,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to place bid' }, { status: 500 })
  }
}
