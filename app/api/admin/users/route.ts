import { NextRequest } from 'next/server'
import { getAllUsers, getAllStores, getAllOrders } from '@/lib/mongodb-operations'

export async function GET(_req: NextRequest) {
  try {
    const [users, stores, orders] = await Promise.all([
      getAllUsers(),
      getAllStores(),
      getAllOrders(),
    ])
    const storeByVendor: Record<string, { storeName?: string; accountStatus?: string }> = {}
    stores.forEach((store: any) => {
      if (!store?.vendorId) return
      storeByVendor[store.vendorId] = {
        storeName: store.storeName,
        accountStatus: store.accountStatus,
      }
    })

    const enriched = users.map((u: any) => {
      const store = storeByVendor[u.id || u._id]
      const userOrders = orders.filter(
        (o: any) => o.customerId === u.id || o.customerId === u._id?.toString?.()
      )
      const ordersCount = userOrders.length
      const totalSpent = userOrders.reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0)
      return {
        id: u.id || u._id,
        name: u.name || u.displayName || 'N/A',
        email: u.email,
        role: u.role || 'customer',
        status: u.status || 'active',
        joinDate: u.createdAt,
        orders: ordersCount,
        totalSpent,
        storeName: store?.storeName,
        storeStatus: store?.accountStatus,
      }
    })

    return new Response(JSON.stringify({ success: true, users: enriched }), { status: 200 })
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error?.message || 'Unknown error' }), { status: 500 })
  }
}
