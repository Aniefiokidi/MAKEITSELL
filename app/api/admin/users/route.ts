import { NextRequest } from 'next/server'
import { getAllUsers, getAllStores, getAllOrders } from '@/lib/mongodb-operations'
import { getSessionUserFromRequest, requireAdminAccess } from '@/lib/server-route-auth'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { AdminAuditLog } from '@/lib/models/AdminAuditLog'

export async function GET(req: NextRequest) {
  const unauthorized = await requireAdminAccess(req)
  if (unauthorized) return unauthorized

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
        vendorType: u.vendorType || u.vendorInfo?.businessType || undefined,
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

export async function PATCH(req: NextRequest) {
  const unauthorized = await requireAdminAccess(req)
  if (unauthorized) return unauthorized

  try {
    const { userId, role, vendorType } = await req.json()
    const normalizedRole = String(role || '').trim()
    const normalizedVendorType = String(vendorType || '').trim()

    if (!userId || !['customer', 'vendor', 'admin'].includes(normalizedRole)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Valid userId and role are required' }),
        { status: 400 }
      )
    }

    if (normalizedRole === 'vendor' && !['goods', 'services', 'both'].includes(normalizedVendorType || 'both')) {
      return new Response(
        JSON.stringify({ success: false, error: 'vendorType must be goods, services, or both' }),
        { status: 400 }
      )
    }

    await connectToDatabase()

    const actor = await getSessionUserFromRequest(req)
    const userBeforeUpdate = await User.findById(userId)
      .select('email role vendorType vendorInfo')
      .lean()

    if (!userBeforeUpdate) {
      return new Response(JSON.stringify({ success: false, error: 'User not found' }), { status: 404 })
    }

    const previousRole = String((userBeforeUpdate as any).role || 'customer')
    const previousVendorType = String((userBeforeUpdate as any).vendorType || (userBeforeUpdate as any).vendorInfo?.businessType || '')

    const updateData: any = {
      $set: {
        role: normalizedRole,
        updatedAt: new Date(),
      },
    }

    if (normalizedRole === 'vendor') {
      const finalVendorType = (normalizedVendorType || 'both') as 'goods' | 'services' | 'both'
      updateData.$set.vendorType = finalVendorType
      updateData.$set['vendorInfo.businessType'] = finalVendorType
      updateData.$set['vendorInfo.isApproved'] = true
    } else {
      updateData.$unset = {
        vendorType: 1,
        vendorInfo: 1,
      }
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true }).lean()

    if (!updatedUser) {
      return new Response(JSON.stringify({ success: false, error: 'User not found' }), { status: 404 })
    }

    const nextRole = String((updatedUser as any).role || 'customer')
    const nextVendorType = String((updatedUser as any).vendorType || (updatedUser as any).vendorInfo?.businessType || '')

    await AdminAuditLog.create({
      action: 'admin_user_role_updated',
      actorUserId: String(actor?.id || 'system'),
      actorEmail: String(actor?.email || ''),
      targetUserId: String((updatedUser as any)._id?.toString?.() || userId),
      targetUserEmail: String((updatedUser as any).email || ''),
      changes: {
        role: {
          from: previousRole,
          to: nextRole,
        },
        vendorType: {
          from: previousVendorType || null,
          to: nextVendorType || null,
        },
      },
      metadata: {
        route: '/api/admin/users',
        method: 'PATCH',
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '',
        userAgent: req.headers.get('user-agent') || '',
      },
      createdAt: new Date(),
    })

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: (updatedUser as any)._id?.toString?.() || String(userId),
          role: (updatedUser as any).role || 'customer',
          vendorType: (updatedUser as any).vendorType || (updatedUser as any).vendorInfo?.businessType || undefined,
        },
      }),
      { status: 200 }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error?.message || 'Failed to update user role' }),
      { status: 500 }
    )
  }
}
