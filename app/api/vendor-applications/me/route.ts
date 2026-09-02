import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { VendorApplication } from '@/lib/models/VendorApplication'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'

export async function GET(request: NextRequest) {
  const user = await getSessionUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await connectToDatabase()

    const application = await VendorApplication.findOne({ userId: user.id })
      .sort({ submittedAt: -1 })
      .lean()

    return NextResponse.json({ success: true, application: application || null })
  } catch (error: any) {
    console.error('[vendor-applications/me] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Could not load application status' },
      { status: 500 }
    )
  }
}
