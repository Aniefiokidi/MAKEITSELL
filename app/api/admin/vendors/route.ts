import { NextRequest } from 'next/server'
import { getAllStores, getAllUsers } from '@/lib/mongodb-operations'

export async function GET(_req: NextRequest) {
  try {
    const [users, stores] = await Promise.all([getAllUsers(), getAllStores()])
    const storeByVendor: Record<string, { storeName?: string; accountStatus?: string }> = {}
    stores.forEach((store: any) => {
      if (!store?.vendorId) return
      storeByVendor[store.vendorId] = {
        storeName: store.storeName,
        accountStatus: store.accountStatus,
      }
    })

    const vendors = users
      .filter((u: any) => u.role === 'vendor')
      .map((vendor: any) => {
        const store = storeByVendor[vendor.id || vendor._id]
        return {
          id: vendor.id || vendor._id,
          email: vendor.email,
          name: vendor.name || vendor.displayName || 'N/A',
          vendorType: vendor.vendorInfo?.type || 'both',
          storeName: store?.storeName || vendor.vendorInfo?.storeName || 'N/A',
          status: store?.accountStatus || vendor.vendorInfo?.status || 'pending',
          createdAt: vendor.createdAt,
        }
      })

    return new Response(JSON.stringify({ success: true, vendors }), { status: 200 })
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error?.message || 'Unknown error' }), { status: 500 })
  }
}
