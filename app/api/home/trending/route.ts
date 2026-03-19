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

  const topProductsRaw = await Product.find({ stock: { $gt: 1 } })
    .sort({ sales: -1, createdAt: -1 })
    .limit(5)
    .lean()

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
    { $limit: 5 },
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
