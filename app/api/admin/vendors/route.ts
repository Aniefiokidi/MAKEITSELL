import { NextRequest } from 'next/server'
import { getAllStores, getAllUsers } from '@/lib/mongodb-operations'
import { requireAdminAccess } from '@/lib/server-route-auth'

export async function GET(req: NextRequest) {
  const unauthorized = await requireAdminAccess(req)
  if (unauthorized) return unauthorized

  try {
    const [users, stores] = await Promise.all([
      getAllUsers(),
      getAllStores(),
    ])

    // Create vendor mapping from stores (store-centric approach)
    const storeByVendorDetailed: Record<string, any> = {}
    
    stores.forEach((store: any) => {
      if (!store?.vendorId) return
      
      // Convert ObjectId to string if needed
      const vendorIdStr = store.vendorId.toString()
      
      const storeData = {
        storeId: store._id?.toString() || '',
        storeName: store.storeName,
        isOpen: store.isOpen !== false,
        accountStatus: store.accountStatus || 'active', 
        vendorAccess: 'free'
      }
      
      storeByVendorDetailed[vendorIdStr] = storeData
    })

    // Create vendor list from users but prioritize those with stores
    const allVendors = users.filter((u: any) => u.role === 'vendor')
    
    // Split vendors into those with stores and those without
    const vendorsWithStores: any[] = []
    const vendorsWithoutStores: any[] = []
    
    allVendors.forEach((vendor: any) => {
      const vendorIdStr = (vendor.id || vendor._id).toString()
      const store = storeByVendorDetailed[vendorIdStr]
      
      const vendorData = {
        id: vendor.id || vendor._id,
        email: vendor.email,
        name: vendor.name || vendor.displayName || 'N/A',
        vendorType: vendor.vendorInfo?.type || 'both',
        storeId: store?.storeId || '',
        storeName: store?.storeName || vendor.vendorInfo?.storeName || 'N/A',
        isOpen: store?.isOpen !== false,
        status: store?.accountStatus || vendor.vendorInfo?.status || 'pending',
        vendorAccess: 'free',
        createdAt: vendor.createdAt,
        hasStore: !!store
      }
      
      if (store) {
        vendorsWithStores.push(vendorData)
      } else {
        vendorsWithoutStores.push(vendorData)
      }
    })
    
    // Return vendors with stores first, then those without
    const vendors = [...vendorsWithStores, ...vendorsWithoutStores]
    
    return new Response(JSON.stringify({ 
      success: true, 
      vendors,
      vendorCount: vendors.length
    }), { status: 200 })
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error?.message || 'Unknown error' }), { status: 500 })
  }
}
