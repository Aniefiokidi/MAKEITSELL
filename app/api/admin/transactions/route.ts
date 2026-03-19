import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { getAllBookings, getAllOrders, getAllUsers } from '@/lib/mongodb-operations'
import { requireAdminAccess } from '@/lib/server-route-auth'

type UserLite = {
  id: string
  name?: string
  email?: string
}

const toIsoString = (value: any) => {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return new Date(0).toISOString()
  return date.toISOString()
}

const toNumber = (value: any) => {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

export async function GET(req: NextRequest) {
  const unauthorized = await requireAdminAccess(req)
  if (unauthorized) return unauthorized

  try {
    await connectToDatabase()

    const [users, orders, bookings, walletTransactions] = await Promise.all([
      getAllUsers(),
      getAllOrders(),
      getAllBookings(),
      WalletTransaction.find({}).sort({ createdAt: -1 }).lean(),
    ])

    const userById: Record<string, UserLite> = {}
    users.forEach((user: any) => {
      const id = String(user?.id || user?._id || '').trim()
      const email = String(user?.email || '').trim()
      const lite: UserLite = {
        id,
        name: user?.name || user?.displayName || email || 'N/A',
        email: email || undefined,
      }

      if (id) userById[id] = lite
      if (email) userById[email] = lite
    })

    const walletRows = walletTransactions.map((tx: any) => {
      const userId = String(tx?.userId || '').trim()
      const actor = userById[userId]
      const type = String(tx?.type || 'wallet')

      return {
        id: `wallet_${String(tx?._id || tx?.reference || Math.random())}`,
        source: 'wallet',
        transactionType: type,
        status: String(tx?.status || 'pending'),
        amount: toNumber(tx?.amount),
        currency: 'NGN',
        reference: String(tx?.reference || tx?._id || ''),
        provider: String(tx?.provider || 'unknown'),
        userId,
        userName: actor?.name || 'N/A',
        userEmail: actor?.email || 'N/A',
        description: String(tx?.note || `${type} wallet transaction`),
        createdAt: toIsoString(tx?.createdAt),
      }
    })

    const orderRows = orders.map((order: any) => {
      const customerId = String(order?.customerId || '').trim()
      const actor = userById[customerId]
      const orderId = String(order?.orderId || order?.id || '').trim()
      const items = Array.isArray(order?.items) ? order.items.length : 0

      return {
        id: `order_${orderId || Math.random()}`,
        source: 'order',
        transactionType: 'order_payment',
        status: String(order?.paymentStatus || order?.status || 'pending'),
        amount: toNumber(order?.totalAmount),
        currency: 'NGN',
        reference: orderId,
        provider: String(order?.paymentMethod || 'unknown'),
        userId: customerId,
        userName: actor?.name || 'N/A',
        userEmail: actor?.email || 'N/A',
        description: `Order ${orderId}${items > 0 ? ` (${items} item${items > 1 ? 's' : ''})` : ''}`,
        createdAt: toIsoString(order?.createdAt),
      }
    })

    const bookingRows = bookings.map((booking: any) => {
      const customerId = String(booking?.customerId || '').trim()
      const actor = userById[customerId]
      const bookingRef = String(booking?.id || booking?._id || '').trim()

      return {
        id: `booking_${bookingRef || Math.random()}`,
        source: 'booking',
        transactionType: 'service_booking',
        status: String(booking?.status || 'pending'),
        amount: toNumber(booking?.finalPrice ?? booking?.totalPrice ?? booking?.estimatedPrice),
        currency: 'NGN',
        reference: bookingRef,
        provider: 'makeitsell',
        userId: customerId,
        userName: actor?.name || booking?.customerName || 'N/A',
        userEmail: actor?.email || booking?.customerEmail || 'N/A',
        description: String(booking?.serviceTitle || 'Service booking'),
        createdAt: toIsoString(booking?.createdAt || booking?.bookingDate),
      }
    })

    const transactions = [...walletRows, ...orderRows, ...bookingRows].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    return NextResponse.json({
      success: true,
      transactions,
      totals: {
        all: transactions.length,
        wallet: walletRows.length,
        order: orderRows.length,
        booking: bookingRows.length,
      },
    })
  } catch (error: any) {
    console.error('[admin/transactions] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch admin transactions' },
      { status: 500 }
    )
  }
}
