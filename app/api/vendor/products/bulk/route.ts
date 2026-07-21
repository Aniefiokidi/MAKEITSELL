import { NextRequest, NextResponse } from "next/server"
import { requireRoles } from "@/lib/server-route-auth"
import { connectToDatabase } from "@/lib/mongodb"
import { Product } from "@/lib/models/Product"
import { cacheNamespaces, invalidateCacheNamespace } from "@/lib/cache-store"
import { syncStreakFloor } from "@/lib/streak/calculateFloor"
import { checkWishlistPriceDrops } from "@/lib/wishlist-price-alerts"
import { checkWishlistRestock } from "@/lib/wishlist-restock-alerts"

type BulkPayload = {
  productIds?: string[]
  updates?: {
    price?: number
    stock?: number
    status?: "active" | "inactive" | "out_of_stock"
    category?: string
  }
}

export async function PATCH(request: NextRequest) {
  const { user, response } = await requireRoles(request, ["vendor", "admin"])
  if (response) return response

  try {
    const payload = (await request.json()) as BulkPayload
    const productIds = Array.isArray(payload.productIds) ? payload.productIds.filter(Boolean) : []
    const updates = payload.updates || {}

    if (productIds.length === 0) {
      return NextResponse.json({ success: false, error: "No products selected" }, { status: 400 })
    }

    const allowedUpdates: Record<string, unknown> = {}

    if (typeof updates.price === "number" && Number.isFinite(updates.price) && updates.price >= 0) {
      allowedUpdates.price = updates.price
    }

    if (typeof updates.stock === "number" && Number.isFinite(updates.stock) && updates.stock >= 0) {
      allowedUpdates.stock = Math.floor(updates.stock)
      if (updates.stock === 0) {
        allowedUpdates.status = "out_of_stock"
      }
    }

    if (typeof updates.status === "string" && ["active", "inactive", "out_of_stock"].includes(updates.status)) {
      allowedUpdates.status = updates.status
    }

    if (typeof updates.category === "string" && updates.category.trim().length > 0) {
      allowedUpdates.category = updates.category.trim()
    }

    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json({ success: false, error: "No valid update fields provided" }, { status: 400 })
    }

    await connectToDatabase()

    const query: Record<string, unknown> = {
      _id: { $in: productIds },
    }

    if (user?.role === "vendor") {
      query.vendorId = user.id
    }

    // Snapshot prices/stock before the write — need the "before" values to know which of
    // these actually crossed a threshold (a bulk update can apply the same new value to
    // products that were on either side of it).
    const beforePrices = ("price" in allowedUpdates)
      ? await Product.find(query).select("price title name").lean()
      : []
    const beforeStocks = ("stock" in allowedUpdates)
      ? await Product.find(query).select("stock title name").lean()
      : []

    const result = await Product.updateMany(query, { $set: allowedUpdates })

    await invalidateCacheNamespace(cacheNamespaces.productsList)
    await invalidateCacheNamespace(cacheNamespaces.productsDetail)

    if ("price" in allowedUpdates) {
      const newPrice = Number(allowedUpdates.price)
      for (const p of beforePrices as any[]) {
        if (newPrice > 0 && newPrice < Number(p.price || 0)) {
          void checkWishlistPriceDrops(String(p._id), newPrice, p.title || p.name)
        }
      }
    }

    if ("stock" in allowedUpdates) {
      const newStock = Number(allowedUpdates.stock)
      for (const p of beforeStocks as any[]) {
        void checkWishlistRestock(String(p._id), Number(p.stock || 0), newStock, p.title || p.name)
      }
    }

    // Price or active-status changed for these products — re-sync every affected vendor's
    // streak floor so a bulk price cut can't leave a locked floor stale.
    if ("price" in allowedUpdates || "status" in allowedUpdates) {
      const vendorIds = await Product.distinct("vendorId", query) as string[]
      void Promise.all(
        vendorIds.filter(Boolean).map((id) => syncStreakFloor(String(id)).catch(() => {}))
      )
    }

    return NextResponse.json({
      success: true,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    })
  } catch (error: any) {
    console.error("Bulk product update failed:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to bulk update products" },
      { status: 500 }
    )
  }
}
