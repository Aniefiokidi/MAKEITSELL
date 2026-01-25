import { NextRequest } from 'next/server'
import { getAllProducts, getAllStores, getAllUsers } from '@/lib/mongodb-operations'

export async function GET(_req: NextRequest) {
  try {
    const [products, stores, users] = await Promise.all([
      getAllProducts(),
      getAllStores(),
      getAllUsers(),
    ])

    const storeByVendor: Record<string, { storeName?: string }> = {}
    stores.forEach((store: any) => {
      if (!store?.vendorId) return
      storeByVendor[store.vendorId] = { storeName: store.storeName }
    })

    const userById: Record<string, { name?: string; email?: string }> = {}
    users.forEach((u: any) => {
      if (!u?.id) return
      userById[u.id] = { name: u.name || u.displayName, email: u.email }
    })

    const enriched = products.map((p: any) => {
      const vendor = userById[p.vendorId || '']
      const store = storeByVendor[p.vendorId || '']
      return {
        ...p,
        title: p.title || p.name || 'Untitled',
        storeName: store?.storeName || 'N/A',
        vendorName: vendor?.name || 'N/A',
        vendorEmail: vendor?.email || 'N/A',
      }
    })

    return new Response(JSON.stringify({ success: true, products: enriched }), { status: 200 })
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error?.message || 'Unknown error' }), { status: 500 })
  }
}
