import { BidListing } from '@/lib/models/BidListing'
import { User } from '@/lib/models/User'
import { WalletTransaction } from '@/lib/models/WalletTransaction'

// Fully releases whatever's currently held from the current highest bidder — shared by
// the reserve-not-met settlement path below and by the admin delete/cancel routes, which
// previously deleted or closed a listing without ever giving that money back.
export async function releaseHighestBidderHold(listing: any, reason: string) {
  const highestBidderId = String(listing?.highestBidderId || '').trim()
  const heldAmount = Number(listing?.highestBidHoldAmount || 0)
  if (!highestBidderId || !(heldAmount > 0)) return

  await User.updateOne(
    { _id: highestBidderId },
    { $inc: { walletBalance: heldAmount }, $set: { updatedAt: new Date() } }
  )

  await WalletTransaction.create({
    userId: highestBidderId,
    type: 'bid_security_release',
    amount: heldAmount,
    status: 'completed',
    reference: `bid_hold_release_${String(listing._id)}_${highestBidderId}_${Date.now()}`,
    provider: 'internal_wallet',
    note: `Bid security released for ${String(listing?.title || 'bid listing')} — ${reason}`,
    metadata: {
      source: 'bidding_hold_release',
      listingId: String(listing._id),
      heldAmount,
      reason,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  })
}

export async function settleExpiredBiddingListings() {
  const now = new Date()

  const listings: any[] = await BidListing.find({
    $or: [
      { status: 'live', endsAt: { $lte: now } },
      { status: 'closed', settlementStatus: { $in: ['pending', 'failed'] } },
    ],
  }).limit(200)

  let settled = 0
  let failed = 0

  for (const listing of listings) {
    try {
      const winningBid = Number(listing?.currentBid || listing?.startPrice || 0)
      const highestBidderId = String(listing?.highestBidderId || '').trim()
      const highestBidderName = String(listing?.highestBidderName || '').trim()
      const heldAmount = Number(listing?.highestBidHoldAmount || 0)
      const reservePrice = Number(listing?.reservePrice || 0)

      // No valid winner: close and settle without charge.
      if (!highestBidderId || !Number.isFinite(winningBid) || winningBid <= 0) {
        listing.status = 'closed'
        listing.settlementStatus = 'settled'
        listing.winnerUserId = undefined
        listing.winnerName = undefined
        listing.winningBidAmount = 0
        listing.settledAt = new Date()
        listing.settlementFailureReason = undefined
        await listing.save()
        settled += 1
        continue
      }

      // Reserve price set and not met: no sale. Release the bidder's full hold rather
      // than charging them for an item the seller wouldn't actually part with at that
      // price — previously reservePrice was captured on every listing but never
      // actually checked anywhere, so it had no effect on the outcome.
      if (reservePrice > 0 && winningBid < reservePrice) {
        await releaseHighestBidderHold(listing, 'reserve price not met')

        listing.status = 'closed'
        listing.settlementStatus = 'settled'
        listing.winnerUserId = undefined
        listing.winnerName = undefined
        listing.winningBidAmount = 0
        listing.settledAt = new Date()
        listing.settlementFailureReason = `Reserve price of ₦${reservePrice.toLocaleString()} was not met (highest bid ₦${winningBid.toLocaleString()})`
        await listing.save()
        settled += 1
        continue
      }

      const additionalDebitNeeded = Math.max(0, winningBid - heldAmount)
      // The bid-hold floor (BID_HOLD_MIN_NAIRA, see app/api/bidding/[id]/bid/route.ts)
      // means a winning bid can be smaller than what was actually held from the wallet —
      // without this, that difference stayed debited forever with no refund.
      const excessHoldToRelease = Math.max(0, heldAmount - winningBid)

      if (additionalDebitNeeded > 0) {
        const debitResult = await User.updateOne(
          { _id: highestBidderId, walletBalance: { $gte: additionalDebitNeeded } },
          { $inc: { walletBalance: -additionalDebitNeeded }, $set: { updatedAt: new Date() } }
        )

        if (debitResult.modifiedCount === 0) {
          listing.status = 'closed'
          listing.settlementStatus = 'failed'
          listing.winnerUserId = highestBidderId
          listing.winnerName = highestBidderName || undefined
          listing.winningBidAmount = winningBid
          listing.settlementFailureReason = 'Highest bidder wallet is insufficient for final settlement.'
          await listing.save()
          failed += 1
          continue
        }

        await WalletTransaction.create({
          userId: highestBidderId,
          type: 'purchase_debit',
          amount: additionalDebitNeeded,
          status: 'completed',
          reference: `bid_settlement_debit_${String(listing._id)}_${highestBidderId}_${Date.now()}`,
          provider: 'internal_wallet',
          note: `Auction settlement debit for ${String(listing?.title || 'bid listing')}`,
          metadata: {
            source: 'bidding_auto_settlement',
            listingId: String(listing._id),
            additionalDebitNeeded,
            winningBid,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      } else if (excessHoldToRelease > 0) {
        await User.updateOne(
          { _id: highestBidderId },
          { $inc: { walletBalance: excessHoldToRelease }, $set: { updatedAt: new Date() } }
        )

        await WalletTransaction.create({
          userId: highestBidderId,
          type: 'bid_security_release',
          amount: excessHoldToRelease,
          status: 'completed',
          reference: `bid_settlement_release_${String(listing._id)}_${highestBidderId}_${Date.now()}`,
          provider: 'internal_wallet',
          note: `Unused portion of bid security hold released for ${String(listing?.title || 'bid listing')}`,
          metadata: {
            source: 'bidding_auto_settlement',
            listingId: String(listing._id),
            heldAmount,
            winningBid,
            excessHoldToRelease,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }

      listing.status = 'closed'
      listing.settlementStatus = 'settled'
      listing.winnerUserId = highestBidderId
      listing.winnerName = highestBidderName || undefined
      listing.winningBidAmount = winningBid
      listing.settledAt = new Date()
      listing.settlementFailureReason = undefined
      await listing.save()
      settled += 1
    } catch {
      failed += 1
    }
  }

  return {
    processed: listings.length,
    settled,
    failed,
  }
}
