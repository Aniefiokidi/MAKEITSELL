import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/mongodb"
import { Store } from "@/lib/models/Store"
import { getCachedPayload, setCachedPayload } from "@/lib/cache-store"

const NAMESPACE = "home-featured-stores"
const CACHE_KEY = "v1"

export async function GET() {
  const cached = await getCachedPayload<any>(NAMESPACE, CACHE_KEY)
  if (cached) return NextResponse.json(cached)

  await connectToDatabase()

  const stores = await Store.find({
    isActive: true,
    $or: [
      { storeImage: { $exists: true, $ne: "" } },
      { profileImage: { $exists: true, $ne: "" } },
      { bannerImages: { $not: { $size: 0 }, $exists: true } },
    ],
  })
    .select("storeName storeDescription storeImage profileImage bannerImages category city state publicSlug vendorId reviewCount")
    .sort({ reviewCount: -1, createdAt: -1 })
    .limit(6)
    .lean()

  const payload = {
    success: true,
    stores: (stores as any[]).map((s) => ({
      id: s._id?.toString(),
      vendorId: String(s.vendorId || ""),
      storeName: s.storeName || "Store",
      storeDescription: s.storeDescription || "",
      image: s.storeImage || s.profileImage || (Array.isArray(s.bannerImages) && s.bannerImages[0]) || "",
      category: s.category || "",
      location: [s.city, s.state].filter(Boolean).join(", "),
      publicSlug: s.publicSlug || "",
      reviewCount: Number(s.reviewCount || 0),
    })),
  }

  await setCachedPayload(NAMESPACE, CACHE_KEY, payload, 300)
  return NextResponse.json(payload)
}
