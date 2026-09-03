// Unifies what used to be three independently-drifted, near-identical inline stock/sales
// decrement implementations, one per payment-confirmation path: the wallet path
// (app/api/payments/initialize/route.ts's deductStock), the Bach path
// (app/api/payments/bach-callback/route.ts), and the Paystack path
// (lib/order-payment-confirmation.ts's decrementStockAndSales). All three now call this
// one function per order item instead of maintaining their own copy.
//
// `stock === 9999` is the pre-existing "made-to-order, never deplete" sentinel (used by
// Food & Beverages) and is preserved exactly. The one genuinely new capability none of the
// three had before: a race-safe atomic decrement for a specific phone-case model, done as
// a single aggregation-pipeline update that clamps both the model's own stock and the
// aggregate stock to a floor of zero against whatever the LIVE document holds at the
// moment it runs — not a snapshot read earlier in this function. This function only ever
// runs after payment has already succeeded, so there is no "reject" case to handle here
// (that already happened earlier, as a fast-fail in lib/order-creation.ts's buildOrder);
// the only job left is to record the sale and clamp stock down without ever going
// negative, even when several decrements for the same model race each other. (An earlier
// version used an $elemMatch+$gte guard with a separate unguarded fallback $inc for ties
// it couldn't satisfy — that fallback could still drive the aggregate stock negative
// under a real race, since it computed its deduction from a stale snapshot; caught by
// scripts/verify-phone-model-stock.ts's concurrent-decrement test.)
import connectToDatabase from '@/lib/mongodb'
import mongoose from 'mongoose'
import { Product } from '@/lib/models/Product'
import { maybeSendLowStockAlert } from '@/lib/stock-alerts'

export type OrderItemForStock = {
  productId?: string
  quantity?: number
  selectedPhoneModel?: string
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
    // Raw driver, not the Mongoose model — sidesteps any schema casting on
    // compatiblePhoneModels (deliberately Schema.Types.Mixed; see lib/models/Product.ts).
    const collection = Product.collection

    const currentProduct: any = await collection.findOne(filter)
    if (!currentProduct) return

    if (currentProduct.stock === 9999) {
      await collection.updateOne(filter, { $inc: { sales: qty } })
      return
    }

    const selectedPhoneModel = String(item?.selectedPhoneModel || '').trim()
    if (selectedPhoneModel) {
      // One atomic pipeline update: clamps the matching model's stock AND the aggregate
      // stock to a floor of zero, and always records the sale — all computed from the
      // live document at the instant this update executes on the server, so N concurrent
      // calls for the same model can never together drive either field below zero no
      // matter how they interleave.
      const updated: any = await collection.findOneAndUpdate(
        { ...filter, compatiblePhoneModels: { $elemMatch: { model: selectedPhoneModel } } },
        [
          {
            $set: {
              compatiblePhoneModels: {
                $map: {
                  input: '$compatiblePhoneModels',
                  in: {
                    $cond: [
                      { $eq: ['$$this.model', selectedPhoneModel] },
                      { model: '$$this.model', stock: { $max: [0, { $subtract: ['$$this.stock', qty] }] } },
                      '$$this',
                    ],
                  },
                },
              },
              stock: { $max: [0, { $subtract: [{ $ifNull: ['$stock', 0] }, qty] }] },
              sales: { $add: [{ $ifNull: ['$sales', 0] }, qty] },
            },
          },
        ],
        { returnDocument: 'after' }
      )
      if (updated) {
        const newStock = Number(updated.stock) || 0
        if (newStock <= 0) await collection.updateOne(filter, { $set: { status: 'out_of_stock' } })
        void maybeSendLowStockAlert(currentProduct, Number(currentProduct.stock) || 0, newStock)
        return
      }
      // No entry for this model in the array (legacy string[] shape, or the model was
      // removed from the curated list after this product was created) — fall through to
      // the flat clamp so the sale is still recorded rather than silently dropped.
    }

    const currentStock = Number(currentProduct.stock) || 0
    const stockDeduction = Math.min(qty, currentStock)
    if (stockDeduction > 0) {
      await collection.updateOne(filter, { $inc: { stock: -stockDeduction, sales: qty } })
      const newStock = currentStock - stockDeduction
      if (newStock <= 0) await collection.updateOne(filter, { $set: { status: 'out_of_stock' } })
      void maybeSendLowStockAlert(currentProduct, currentStock, newStock)
    } else {
      await collection.updateOne(filter, { $inc: { sales: qty } })
    }
  } catch (err) {
    console.error('[product-stock] decrementProductStockForOrderItem failed', err)
  }
}
