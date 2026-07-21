// Event-driven back-in-stock notifications — mirrors lib/wishlist-price-alerts.ts.
// Called from product mutation routes right after a stock change is persisted; the
// before/after comparison itself is the idempotency guard (only fires on the exact
// 0 -> >0 crossing), so no separate "already notified" flag is needed.

import connectToDatabase from '@/lib/mongodb'
import { Wishlist } from '@/lib/models/Wishlist'
import { pushToUser } from '@/lib/push-notifications'

export async function checkWishlistRestock(productId: string, oldStock: number, newStock: number, productTitle?: string): Promise<void> {
  if (!productId || oldStock > 0 || !(newStock > 0)) return

  try {
    await connectToDatabase()

    const affected = await Wishlist.find({
      items: { $elemMatch: { productId } },
    }).lean() as any[]

    if (affected.length === 0) return

    for (const wishlist of affected) {
      const item = (wishlist.items || []).find((i: any) => i.productId === productId)
      if (!item) continue

      const title = productTitle || item.title || 'An item'

      void pushToUser(String(wishlist.userId), {
        title: 'Back in Stock 🎉',
        body: `${title} is back in stock — it's on your wishlist!`,
        url: '/user/wishlist',
        tag: `wishlist-restock-${productId}`,
      }).catch(() => {})
    }
  } catch (error) {
    console.error('[wishlist-restock-alerts] Failed:', error)
  }
}
