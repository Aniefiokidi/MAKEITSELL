import { BidListing } from '@/lib/models/BidListing'
import { User } from '@/lib/models/User'
import { WalletTransaction } from '@/lib/models/WalletTransaction'

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

      const additionalDebitNeeded = Math.max(0, winningBid - heldAmount)

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
