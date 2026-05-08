import { NextRequest, NextResponse } from 'next/server'
import {
  deleteStore,
  deleteProductsByVendor,
  deleteOrdersByVendor,
  deleteUserCartItemsByVendor,
  deleteServicesByVendor,
  deleteBookingsByVendor,
  deleteConversationsByVendor,
  deleteUser,
  deleteSessions
} from '@/lib/mongodb-operations'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'

export async function DELETE(request: NextRequest) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const userId = String(body?.userId || '').trim()
    // vendorId defaults to userId — for vendors they're the same; for customers
    // who somehow have stores, this ensures cleanup still runs.
    const vendorId = String(body?.vendorId || userId).trim()

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 })
    }

    // User can only delete their own account; admins may delete any account
    if (sessionUser.role !== 'admin' && sessionUser.id !== userId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    console.log(`Starting account deletion for vendor: ${vendorId}, user: ${userId}`)

    // Delete all vendor-related data in sequence
    const deletionResults = {
      store: false,
      products: false,
      services: false,
      orders: false,
      bookings: false,
      cartItems: false,
      conversations: false,
      sessions: false,
      user: false
    }

    try {
      // 1. Delete store
      console.log('Deleting store...')
      await deleteStore(vendorId)
      deletionResults.store = true
      console.log('Store deleted successfully')

      // 2. Delete all products
      console.log('Deleting products...')
      await deleteProductsByVendor(vendorId)
      deletionResults.products = true
      console.log('Products deleted successfully')

      // 3. Delete all services
      console.log('Deleting services...')
      await deleteServicesByVendor(vendorId)
      deletionResults.services = true
      console.log('Services deleted successfully')

      // 4. Delete orders (mark as cancelled or keep for record-keeping)
      console.log('Updating orders...')
      await deleteOrdersByVendor(vendorId)
      deletionResults.orders = true
      console.log('Orders updated successfully')

      // 5. Delete bookings
      console.log('Deleting bookings...')
      await deleteBookingsByVendor(vendorId)
      deletionResults.bookings = true
      console.log('Bookings deleted successfully')

      // 6. Remove vendor products from user carts
      console.log('Cleaning user carts...')
      await deleteUserCartItemsByVendor(vendorId)
      deletionResults.cartItems = true
      console.log('User carts cleaned successfully')

      // 7. Delete conversations
      console.log('Deleting conversations...')
      await deleteConversationsByVendor(vendorId)
      deletionResults.conversations = true
      console.log('Conversations deleted successfully')

      // 8. Delete user sessions
      console.log('Deleting sessions...')
      await deleteSessions(userId)
      deletionResults.sessions = true
      console.log('Sessions deleted successfully')

      // 9. Delete user account
      console.log('Deleting user account...')
      await deleteUser(userId)
      deletionResults.user = true
      console.log('User account deleted successfully')

      console.log('Account deletion completed successfully')

      return NextResponse.json({
        success: true,
        message: 'Account and all associated data deleted successfully',
        deletionResults
      })

    } catch (error: any) {
      console.error('Error during deletion process:', error)
      return NextResponse.json({
        success: false,
        error: `Deletion failed: ${error.message}`,
        deletionResults
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Delete account API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to process deletion request'
    }, { status: 500 })
  }
}