import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { User } from '@/lib/models/User'

export async function PUT(request: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const address = String(body?.address || '').trim()
    const state = String(body?.state || '').trim()
    const city = String(body?.city || '').trim()

    if (!address || !state || !city) {
      return NextResponse.json(
        { success: false, error: 'Address, state, and city are required' },
        { status: 400 }
      )
    }

    await connectToDatabase()

    const updatedUser = await User.findByIdAndUpdate(
      sessionUser.id,
      {
        $set: {
          address,
          state,
          city,
          addressRecapturedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { new: true }
    ).lean()

    if (!updatedUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: String((updatedUser as any)._id),
        address: (updatedUser as any).address || '',
        state: (updatedUser as any).state || '',
        city: (updatedUser as any).city || '',
      },
    })
  } catch (error: any) {
    console.error('[address-recapture] update error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save address details' },
      { status: 500 }
    )
  }
}
