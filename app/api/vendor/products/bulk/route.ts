import { NextRequest, NextResponse } from "next/server"
import { requireRoles } from "@/lib/server-route-auth"
import { connectToDatabase } from "@/lib/mongodb"
import { Product } from "@/lib/models/Product"
import { cacheNamespaces, invalidateCacheNamespace } from "@/lib/cache-store"

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

    const result = await Product.updateMany(query, { $set: allowedUpdates })

    await invalidateCacheNamespace(cacheNamespaces.productsList)
    await invalidateCacheNamespace(cacheNamespaces.productsDetail)

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
