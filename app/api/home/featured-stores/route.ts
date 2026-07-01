import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/mongodb"
import { Store } from "@/lib/models/Store"
import { Product } from "@/lib/models/Product"
import { getCachedPayload, setCachedPayload } from "@/lib/cache-store"

const NAMESPACE = "home-featured-stores"
const CACHE_KEY = "v2"

export async function GET() {
  const cached = await getCachedPayload<any>(NAMESPACE, CACHE_KEY)
  if (cached) return NextResponse.json(cached)

  await connectToDatabase()

  // Only feature stores that have at least one product listed
  const vendorIdsWithProducts = await Product.distinct("vendorId", { stock: { $gt: 0 } }) as string[]

  if (!vendorIdsWithProducts.length) {
    return NextResponse.json({ success: true, stores: [] })
  }

  const stores = await Store.find({
    isActive: true,
    vendorId: { $in: vendorIdsWithProducts },
    // Require a real profile or store image — bannerImages alone is not enough
    $or: [
      { storeImage: { $exists: true, $ne: "" } },
      { profileImage: { $exists: true, $ne: "" } },
    ],
  })
    .select("storeName storeDescription storeImage profileImage bannerImages logo category city state publicSlug vendorId reviewCount")
    .sort({ reviewCount: -1, createdAt: -1 })
    .limit(12)
    .lean()

  // Count products per store so personalizeStores() can use productCount for completeness scoring
  const storeVendorIds = (stores as any[]).map((s) => String(s.vendorId || "")).filter(Boolean)
  const productCounts = storeVendorIds.length
    ? await Product.aggregate([
        { $match: { vendorId: { $in: storeVendorIds }, stock: { $gt: 0 } } },
        { $group: { _id: "$vendorId", count: { $sum: 1 } } },
      ])
    : []

  const productCountByVendorId = new Map<string, number>()
  for (const row of productCounts) {
    productCountByVendorId.set(String(row._id || ""), Number(row.count || 0))
  }

  const payload = {
    success: true,
    stores: (stores as any[]).map((s) => {
      const vendorId = String(s.vendorId || "")
      const image = s.storeImage || s.profileImage || (Array.isArray(s.bannerImages) && s.bannerImages[0]) || ""
      return {
        id: s._id?.toString(),
        vendorId,
        storeName: s.storeName || "Store",
        storeDescription: s.storeDescription || "",
        // display image
        image,
        // individual fields so personalizeStores() can run storeCompletenessTier
        storeImage: s.storeImage || "",
        profileImage: s.profileImage || "",
        logo: s.logo || "",
        category: s.category || "",
        location: [s.city, s.state].filter(Boolean).join(", "),
        city: s.city || "",
        state: s.state || "",
        publicSlug: s.publicSlug || "",
        reviewCount: Number(s.reviewCount || 0),
        productCount: productCountByVendorId.get(vendorId) || 1,
      }
    }),
  }

  await setCachedPayload(NAMESPACE, CACHE_KEY, payload, 300)
  return NextResponse.json(payload)
}
