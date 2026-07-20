import { NextResponse } from "next/server"
import mongoose from "mongoose"
import connectToDatabase from "@/lib/mongodb"
import { Product } from "@/lib/models/Product"
import { Store } from "@/lib/models/Store"
import { Booking } from "@/lib/models/Booking"
import { getCachedPayload, setCachedPayload } from "@/lib/cache-store"

const HOME_TRENDING_NAMESPACE = "home-trending"
const HOME_TRENDING_CACHE_KEY = "top-v1"

type TrendingPayload = {
  success: true
  data: {
    products: any[]
    services: any[]
  }
}

export async function GET() {
  const cached = await getCachedPayload<TrendingPayload>(HOME_TRENDING_NAMESPACE, HOME_TRENDING_CACHE_KEY)
  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    })
  }

  await connectToDatabase()

  // A wide candidate pool, independent of how many any given section on the page
  // actually displays — the display layer slices down to whatever fits one row of its
  // own grid (see app/page.tsx). A wider pool here just means more variety to draw from.
  const CANDIDATE_POOL_SIZE = 24

  // Sorting by sales only means something once at least one product actually has sales.
  // Until then, every product ties at 0 and the sort silently collapses to its tiebreak
  // (createdAt desc) — which quietly turns "bestsellers" into "newest first" without
  // saying so. Detect that case and sample randomly instead, so the section is honest
  // about not having real signal yet, and so exposure rotates across the catalog rather
  // than permanently favoring the same handful of newest items (which also helps real
  // sales data start accumulating more broadly once purchases begin).
  const hasAnyRealSales = await Product.exists({ stock: { $gt: 0 }, sales: { $gt: 0 } })

  const topProductsRaw = hasAnyRealSales
    ? await Product.find({ stock: { $gt: 0 } })
        .sort({ sales: -1, createdAt: -1 })
        .limit(CANDIDATE_POOL_SIZE)
        .lean()
    : await Product.aggregate([
        { $match: { stock: { $gt: 0 } } },
        { $sample: { size: CANDIDATE_POOL_SIZE } },
      ])

  const vendorIds = Array.from(
    new Set(topProductsRaw.map((product: any) => String(product.vendorId || "")).filter(Boolean))
  )

  const stores = vendorIds.length
    ? await Store.find({ vendorId: { $in: vendorIds } })
        .select("vendorId storeName")
        .lean()
    : []

  const storeNameByVendorId = new Map<string, string>()
  for (const store of stores as any[]) {
    const vendorId = String(store.vendorId || "")
    if (!vendorId || storeNameByVendorId.has(vendorId)) continue
    storeNameByVendorId.set(vendorId, String(store.storeName || ""))
  }

  const topProducts = topProductsRaw.map((product: any) => {
    const vendorId = String(product.vendorId || "")
    const fallbackStoreName = vendorId ? `Store ${vendorId.slice(-6)}` : "Store"
    const storeName =
      storeNameByVendorId.get(vendorId) ||
      product.vendorName ||
      fallbackStoreName

    return {
      ...product,
      id: product._id?.toString?.() || product.id,
      storeName,
      vendorName: storeName,
    }
  })

  const topServiceBookings = await Booking.aggregate([
    {
      $match: {
        status: { $ne: "cancelled" },
        serviceId: { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: { $toString: "$serviceId" },
        bookingCount: { $sum: 1 },
      },
    },
    { $sort: { bookingCount: -1 } },
    { $limit: 8 },
  ])

  const serviceIds = topServiceBookings.map((entry: any) => String(entry._id || "")).filter(Boolean)
  const objectIds = serviceIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id))

  const ServiceModel =
    (mongoose.models.Service as mongoose.Model<any>) ||
    mongoose.model("Service", new mongoose.Schema({}, { strict: false }))

  const services = objectIds.length
    ? await ServiceModel.find({ _id: { $in: objectIds } }).lean()
    : []

  const serviceById = new Map<string, any>()
  for (const service of services as any[]) {
    serviceById.set(String(service._id), service)
  }

  const topServices = topServiceBookings
    .map((entry: any) => {
      const serviceId = String(entry._id || "")
      const service = serviceById.get(serviceId)
      if (!service) return null

      return {
        ...service,
        id: service._id?.toString?.() || service.id,
        bookingCount: entry.bookingCount || 0,
      }
    })
    .filter(Boolean)

  const payload: TrendingPayload = {
    success: true,
    data: {
      products: topProducts,
      services: topServices,
    },
  }

  await setCachedPayload(HOME_TRENDING_NAMESPACE, HOME_TRENDING_CACHE_KEY, payload, 60)

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  })
}
