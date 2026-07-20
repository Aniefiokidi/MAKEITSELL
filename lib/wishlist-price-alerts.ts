// Event-driven wishlist price-drop notifications. Called from the product mutation
// routes right after a price change is persisted — no cron needed, since "notify when
// price drops" is naturally triggered by the price-change event itself, and firing
// immediately is both simpler and more useful to the customer than a daily batch job.

import connectToDatabase from '@/lib/mongodb'
import { Wishlist } from '@/lib/models/Wishlist'
import { pushToUser } from '@/lib/push-notifications'

export async function checkWishlistPriceDrops(productId: string, newPrice: number, productTitle?: string): Promise<void> {
  if (!productId || !Number.isFinite(newPrice) || newPrice <= 0) return

  try {
    await connectToDatabase()

    const affected = await Wishlist.find({
      items: { $elemMatch: { productId, price: { $gt: newPrice } } },
    }).lean() as any[]

    if (affected.length === 0) return

    for (const wishlist of affected) {
      const item = (wishlist.items || []).find((i: any) => i.productId === productId)
      if (!item) continue

      const previousPrice = Number(item.price || 0)
      const title = productTitle || item.title || 'An item'

      void pushToUser(String(wishlist.userId), {
        title: 'Price Drop 🎉',
        body: `${title} dropped from ₦${previousPrice.toLocaleString('en-NG')} to ₦${newPrice.toLocaleString('en-NG')} — it's on your wishlist!`,
        url: '/user/wishlist',
        tag: `wishlist-price-drop-${productId}`,
      }).catch(() => {})
    }

    // Update the stored price for every affected wishlist entry so the next comparison
    // is against the new price, not the old one — otherwise this would re-fire on every
    // subsequent save even without a further drop.
    await Wishlist.updateMany(
      { items: { $elemMatch: { productId, price: { $gt: newPrice } } } },
      { $set: { 'items.$[elem].price': newPrice } },
      { arrayFilters: [{ 'elem.productId': productId, 'elem.price': { $gt: newPrice } }] }
    )
  } catch (error) {
    // Never let a notification failure break the product update that triggered it.
    console.error('[wishlist-price-alerts] Failed:', error)
  }
}
