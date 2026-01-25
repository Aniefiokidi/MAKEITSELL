import { NextRequest } from 'next/server'
import { getAllOrders, getAllUsers, getAllStores } from '@/lib/mongodb-operations'

export async function GET(_req: NextRequest) {
  try {
    const [orders, users, stores] = await Promise.all([
      getAllOrders(),
      getAllUsers(),
      getAllStores(),
    ])

    const userById: Record<string, { name?: string; email?: string }> = {}
    users.forEach((u: any) => {
      const key = u.id || u._id?.toString?.()
      if (!key) return
      userById[key] = { name: u.name || u.displayName, email: u.email }
    })

    const storeById: Record<string, { storeName?: string }> = {}
    stores.forEach((s: any) => {
      const storeKey = s.id || s._id?.toString?.()
      const vendorKey = s.vendorId
      if (storeKey) storeById[storeKey] = { storeName: s.storeName }
      if (vendorKey) storeById[vendorKey] = { storeName: s.storeName }
    })

    const enriched = orders.map((o: any) => {
      const customer = userById[o.customerId] || {}
      
      let storeNames: string[] = []
      if (Array.isArray(o.vendors)) {
        storeNames = o.vendors
          .map((v: any) => storeById[v.storeId] || storeById[v.vendorId])
          .filter(Boolean)
          .map((s: any) => s.storeName)
      }
      if (storeNames.length === 0 && Array.isArray(o.storeIds)) {
        storeNames = o.storeIds
          .map((sid: string) => storeById[sid])
          .filter(Boolean)
          .map((s: any) => s.storeName)
      }

      return {
        ...o,
        customerName: customer.name || 'N/A',
        customerEmail: customer.email || 'N/A',
        storeNames,
      }
    })

    return new Response(JSON.stringify({ success: true, orders: enriched }), { status: 200 })
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error?.message || 'Unknown error' }), { status: 500 })
  }
}
