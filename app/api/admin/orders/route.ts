import { NextRequest } from 'next/server'
import { getAllOrders, getAllUsers, getAllStores, getAllProducts } from '@/lib/mongodb-operations'

export async function GET(_req: NextRequest) {
  try {
    const [orders, users, stores, products] = await Promise.all([
      getAllOrders(),
      getAllUsers(),
      getAllStores(),
      getAllProducts(),
    ])

    // Build lookup maps with multiple ID format support
    const userById: Record<string, { name?: string; email?: string }> = {}
    users.forEach((u: any) => {
      const key = u.id || u._id?.toString?.() || String(u._id)
      if (!key) return
      const userName = u.name || u.displayName || u.email
      userById[key] = { name: userName, email: u.email }
      // Also add by email as fallback
      if (u.email) userById[u.email] = { name: userName, email: u.email }
    })
    console.log('[/api/admin/orders] userById keys:', Object.keys(userById).slice(0, 5))
    console.log('[/api/admin/orders] sample user:', Object.values(userById)[0])

    const storeById: Record<string, { storeName?: string }> = {}
    stores.forEach((s: any) => {
      const storeKey = s.id || s._id?.toString?.() || String(s._id)
      const vendorKey = s.vendorId
      if (storeKey) storeById[storeKey] = { storeName: s.storeName || s.name }
      if (vendorKey) storeById[vendorKey] = { storeName: s.storeName || s.name }
    })

    const productById: Record<string, any> = {}
    products.forEach((p: any) => {
      const pId = p.id || p._id?.toString?.() || String(p._id)
      if (pId) productById[pId] = p
    })
    console.log('[/api/admin/orders] productById keys count:', Object.keys(productById).length)
    console.log('[/api/admin/orders] sample products:', Object.keys(productById).slice(0, 3).map(k => ({ id: k, hasImages: !!productById[k]?.images?.length })))

    const enriched = orders.map((o: any) => {
      // Resolve customer from database using registered name
      const customer = userById[o.customerId] || userById[String(o.customerId)] || {}
      const customerName = customer.name || 'N/A'
      const customerEmail = customer.email || 'N/A'
      
      // Debug first few orders
      if (!customer.name) {
        console.log('[/api/admin/orders] Customer not found:', { customerId: o.customerId, availableKeys: Object.keys(userById).slice(0, 3) })
      }

      // Resolve stores from database
      let storeNames: string[] = []
      if (Array.isArray(o.vendors) && o.vendors.length > 0) {
        storeNames = o.vendors
          .map((v: any) => {
            const store = storeById[v.storeId] || storeById[v.vendorId] || storeById[String(v.storeId)] || storeById[String(v.vendorId)]
            return store?.storeName
          })
          .filter(Boolean)
      }
      
      // Fallback to storeIds if vendors didn't yield results
      if (storeNames.length === 0 && Array.isArray(o.storeIds) && o.storeIds.length > 0) {
        storeNames = o.storeIds
          .map((sid: string) => storeById[sid]?.storeName || storeById[String(sid)]?.storeName)
          .filter(Boolean)
      }

      // Enrich all items with product information including images
      const enrichedItems = Array.isArray(o.items) ? o.items.map((item: any, idx: number) => {
        const productFromDb = productById[item.productId] || productById[String(item.productId)]
        
        // Get images: priority 1=from productFromDb, 2=from item itself, 3=empty
        const images = productFromDb?.images?.length > 0 
          ? productFromDb.images 
          : (item.images?.length > 0 ? item.images : [])
        
        const enrichedItem = {
          ...item,
          images: images,
          title: productFromDb?.title || item.title || item.name || 'Product',
          name: productFromDb?.name || item.name || productFromDb?.title || item.title || 'Product',
          price: item.price || productFromDb?.price || 0,
        }
        return enrichedItem
      }) : []

      return {
        ...o,
        customerName,
        customerEmail,
        storeNames,
        items: enrichedItems,
      }
    })

    return new Response(JSON.stringify({ success: true, orders: enriched }), { status: 200 })
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error?.message || 'Unknown error' }), { status: 500 })
  }
}
