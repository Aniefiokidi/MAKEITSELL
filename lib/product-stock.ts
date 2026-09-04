// Unifies what used to be three independently-drifted, near-identical inline stock/sales
// decrement implementations, one per payment-confirmation path: the wallet path
// (app/api/payments/initialize/route.ts's deductStock), the Bach path
// (app/api/payments/bach-callback/route.ts), and the Paystack path
// (lib/order-payment-confirmation.ts's decrementStockAndSales). All three now call this
// one function per order item instead of maintaining their own copy.
//
// `stock === 9999` is the pre-existing "made-to-order, never deplete" sentinel (used by
// Food & Beverages) and is preserved exactly. The other capability: a race-safe atomic
// decrement for any number of selected variant values (a compatible device model, a
// color, a size, ...) via lib/models/Product.ts's generalized `variants` field, plus an
// atomic top-level stock/sales update that runs exactly once per order item regardless of
// how many variant labels it has.
//
// Two separate steps, deliberately not combined into one update per variant entry:
// 1. Per-entry loop (0, 1, or N times) — clamps ONLY the matched `variants` array entry's
//    own stock, atomically against the live document at the instant each update runs.
// 2. One trailing top-level `stock`/`sales` update, atomically against the live document,
//    always exactly once per order item. An earlier version combined both into a single
//    per-entry pipeline (correct for the original single-phone-model case, which only
//    ever had one variant), but generalizing it to loop per selectedVariants entry would
//    have decremented the top-level stock/sales once per entry — double-counting a single
//    unit sold for any multi-label item (e.g. Color + Size). Splitting the two concerns
//    fixes that while keeping both atomic.
import connectToDatabase from '@/lib/mongodb'
import mongoose from 'mongoose'
import { Product } from '@/lib/models/Product'
import { maybeSendLowStockAlert } from '@/lib/stock-alerts'

export type OrderItemForStock = {
  productId?: string
  quantity?: number
  selectedVariants?: Array<{ label: string; value: string }>
}

export async function decrementProductStockForOrderItem(item: OrderItemForStock): Promise<void> {
  const qty = Number(item?.quantity) || 1
  const rawProductId = String(item?.productId || '').trim()

  // Same broad $or matching the Bach and Paystack paths already used — a product is
  // matched by a valid _id, or (for older/irregular data) a productId or id field —
  // kept as-is rather than narrowed to just _id, so no existing product stops matching.
  const filters: any[] = []
  if (rawProductId) {
    if (mongoose.Types.ObjectId.isValid(rawProductId)) {
      filters.push({ _id: new mongoose.Types.ObjectId(rawProductId) })
    }
    filters.push({ productId: rawProductId })
    filters.push({ id: rawProductId })
  }
  if (filters.length === 0) {
    console.warn('[product-stock] Skipping stock update; no valid productId on item', item)
    return
  }
  const filter = { $or: filters }

  try {
    await connectToDatabase()
    // Raw driver, not the Mongoose model — sidesteps Mongoose entirely for these
    // updates (the aggregation-pipeline update syntax below isn't something Mongoose's
    // query builder does anyway).
    const collection = Product.collection

    const currentProduct: any = await collection.findOne(filter)
    if (!currentProduct) return

    if (currentProduct.stock === 9999) {
      await collection.updateOne(filter, { $inc: { sales: qty } })
      return
    }

    const selectedVariants = Array.isArray(item?.selectedVariants) ? item.selectedVariants : []

    // Step 1: per-entry loop.
    for (const selected of selectedVariants) {
      const label = String(selected?.label || '').trim()
      const value = String(selected?.value || '').trim()
      if (!label || !value) continue
      try {
        const updated = await collection.findOneAndUpdate(
          { ...filter, variants: { $elemMatch: { label, value } } },
          [
            {
              $set: {
                variants: {
                  $map: {
                    input: '$variants',
                    in: {
                      $cond: [
                        { $and: [{ $eq: ['$$this.label', label] }, { $eq: ['$$this.value', value] }] },
                        { label: '$$this.label', value: '$$this.value', stock: { $max: [0, { $subtract: ['$$this.stock', qty] }] } },
                        '$$this',
                      ],
                    },
                  },
                },
              },
            },
          ],
          { returnDocument: 'after' }
        )
        if (!updated) {
          // No matching entry — legacy pre-`variants` data (compatiblePhoneModels/
          // colors/sizes not yet migrated by a save through the new vendor form), or the
          // value was removed from the curated list after this product was created. The
          // top-level update in step 2 still records the sale; only this specific
          // value's own pool misses out on being decremented until the product is next
          // saved through the vendor form (which re-seeds `variants` via
          // normalizeProductVariants).
          console.warn(
            `[product-stock] no matching variant "${label}: ${value}" on product ${rawProductId} — top-level stock still recorded`
          )
        }
      } catch (variantErr) {
        // Never let one variant entry's failure stop the others, or the top-level
        // record-the-sale step below. True cross-entry atomicity would need a
        // multi-document transaction, which this function deliberately doesn't take on —
        // logged here for manual reconciliation instead.
        console.error(
          `[product-stock] partial variant decrement failure for "${label}: ${value}" on product ${rawProductId}`,
          variantErr
        )
      }
    }

    // Step 2: exactly one top-level stock/sales update per order item, computed
    // atomically against the live document (not a stale snapshot) so concurrent
    // decrements for the same product — variant or not — can never together drive the
    // aggregate stock negative.
    const updatedProduct: any = await collection.findOneAndUpdate(
      filter,
      [
        {
          $set: {
            stock: { $max: [0, { $subtract: [{ $ifNull: ['$stock', 0] }, qty] }] },
            sales: { $add: [{ $ifNull: ['$sales', 0] }, qty] },
          },
        },
      ],
      { returnDocument: 'after' }
    )
    if (updatedProduct) {
      const newStock = Number(updatedProduct.stock) || 0
      if (newStock <= 0) await collection.updateOne(filter, { $set: { status: 'out_of_stock' } })
      void maybeSendLowStockAlert(currentProduct, Number(currentProduct.stock) || 0, newStock)
    }
  } catch (err) {
    console.error('[product-stock] decrementProductStockForOrderItem failed', err)
  }
}
