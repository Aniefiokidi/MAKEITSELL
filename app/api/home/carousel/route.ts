import { NextResponse } from "next/server"
import { getCachedPayload, setCachedPayload } from "@/lib/cache-store"
import { getProducts, getServices, getStores } from "@/lib/mongodb-operations"

const CACHE_NS = "home-carousel"
const CACHE_KEY = "v1"
const CACHE_TTL_S = 300 // 5 minutes server-side

export const dynamic = "force-dynamic"

export async function GET() {
  const cached = await getCachedPayload<{ products: any[]; services: any[]; stores: any[] }>(CACHE_NS, CACHE_KEY)
  if (cached) {
    return NextResponse.json({ success: true, data: cached }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    })
  }

  const [productsResult, servicesResult, storesResult] = await Promise.allSettled([
    getProducts({ limitCount: 8 }),
    getServices({ limitCount: 8 }),
    getStores({ limitCount: 8 }),
  ])

  const products = productsResult.status === "fulfilled" ? (Array.isArray(productsResult.value) ? productsResult.value : (productsResult.value as any)?.data ?? []) : []
  const services = servicesResult.status === "fulfilled" ? (Array.isArray(servicesResult.value) ? servicesResult.value : (servicesResult.value as any)?.data ?? []) : []
  const stores = storesResult.status === "fulfilled" ? (Array.isArray(storesResult.value) ? storesResult.value : (storesResult.value as any)?.data ?? []) : []

  const payload = { products, services, stores }
  await setCachedPayload(CACHE_NS, CACHE_KEY, payload, CACHE_TTL_S)

  return NextResponse.json({ success: true, data: payload }, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  })
}
