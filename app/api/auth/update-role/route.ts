import { NextRequest, NextResponse } from 'next/server'
import { updateUserProfileInDb, getUserById } from '@/lib/mongodb-operations'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { role, vendorType } = await request.json()

    // This endpoint only does one thing: a logged-in customer self-upgrading their own
    // account to vendor. It never accepts a target userId from the body (always the
    // caller's own session) and never accepts any other role value — this used to take
    // both directly from the request body, which meant anyone could set role: 'admin'
    // on any userId with a single unauthenticated request.
    if (role !== 'vendor') {
      return NextResponse.json({ success: false, error: 'Invalid role' }, { status: 400 })
    }

    const userId = sessionUser.id

    const updateData: any = {
      role: 'vendor',
      vendorInfo: {
        businessType: vendorType || 'both',
        businessName: '', // Can be updated later
        isApproved: true
      }
    }

    const result = await updateUserProfileInDb(userId, updateData)

    if (result.success) {
      // Get updated user data
      const updatedUser = await getUserById(userId)
      
      return NextResponse.json({
        success: true,
        user: updatedUser
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'Failed to update user role'
      }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Update role error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to update role'
    }, { status: 500 })
  }
}