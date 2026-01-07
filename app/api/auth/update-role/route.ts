import { NextRequest, NextResponse } from 'next/server'
import { updateUser, getUserById } from '@/lib/mongodb-operations'

export async function POST(request: NextRequest) {
  try {
    const { userId, role, vendorType } = await request.json()
    
    if (!userId || !role) {
      return NextResponse.json({
        success: false,
        error: 'Missing userId or role'
      }, { status: 400 })
    }

    // Update user role
    const updateData: any = { role }
    
    // Add vendor-specific fields if upgrading to vendor
    if (role === 'vendor') {
      updateData.vendorInfo = {
        businessType: vendorType || 'both',
        businessName: '', // Can be updated later
        isApproved: true
      }
    }

    const result = await updateUser(userId, updateData)

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