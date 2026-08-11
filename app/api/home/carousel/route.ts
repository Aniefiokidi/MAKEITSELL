import { NextResponse } from "next/server"
import { getCachedPayload, setCachedPayload } from "@/lib/cache-store"
import { getProducts, getServices, getStores } from "@/lib/mongodb-operations"

const CACHE_NS = "home-carousel"
// Bumped from v1 — the previous cache key can hold entries built before the stores
// field-whitelist fix below existed (getStores() returns the raw document, which
// includes bank/wallet/phone/email), and this cache store persists independently of
// the app process, so a code fix alone doesn't invalidate what's already cached under
// the old key.
const CACHE_KEY = "v2"
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
  const rawStores = storesResult.status === "fulfilled" ? (Array.isArray(storesResult.value) ? storesResult.value : (storesResult.value as any)?.data ?? []) : []

  // getStores() returns the raw Store document with no projection — this route is
  // public/unauthenticated, and that document also holds payout/banking fields
  // (bankName, bankCode, accountNumber, accountName, walletBalance,
  // linkedWalletUserId) plus the vendor's phone/email. Whitelist to public storefront
  // fields only, same set already used by /api/database/stores and
  // /api/database/stores/[id].
  const stores = (rawStores as any[]).map((store) => ({
    id: store._id?.toString?.() || store.id,
    publicSlug: store.publicSlug,
    storeName: store.storeName,
    storeDescription: store.storeDescription,
    storeImage: store.storeImage,
    profileImage: store.profileImage,
    bannerImages: store.bannerImages,
    location: store.address,
    address: store.address,
    city: store.city,
    state: store.state,
    category: store.category,
    vendorId: store.vendorId,
    isOpen: store.isOpen,
    isActive: store.isActive,
    deliveryTime: store.deliveryTime,
    deliveryFee: store.deliveryFee,
    minimumOrder: store.minimumOrder,
    reviewCount: store.reviewCount,
    accountVerified: !!store.accountVerified,
    createdAt: store.createdAt,
    updatedAt: store.updatedAt,
  }))

  const payload = { products, services, stores }
  await setCachedPayload(CACHE_NS, CACHE_KEY, payload, CACHE_TTL_S)

  return NextResponse.json({ success: true, data: payload }, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  })
}
