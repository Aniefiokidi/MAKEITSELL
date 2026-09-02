import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { VendorApplication } from '@/lib/models/VendorApplication'
import { User } from '@/lib/models/User'
import { updateUserProfileInDb } from '@/lib/mongodb-operations'
import { requireRoles } from '@/lib/server-route-auth'

export async function GET(request: NextRequest) {
  const { response } = await requireRoles(request, ['admin'])
  if (response) return response

  try {
    await connectToDatabase()

    const { searchParams } = new URL(request.url)
    const status = String(searchParams.get('status') || 'pending').trim()

    const applications = await VendorApplication.find({ status })
      .sort({ submittedAt: -1 })
      .limit(200)
      .lean()

    const userIds = [...new Set(applications.map((app: any) => String(app.userId)))]
    const users = await User.find({ _id: { $in: userIds } }, 'name email').lean()
    const userById = new Map(users.map((u: any) => [String(u._id), u]))

    const enriched = applications.map((app: any) => ({
      ...app,
      applicantName: userById.get(String(app.userId))?.name || null,
      applicantEmail: userById.get(String(app.userId))?.email || null,
    }))

    return NextResponse.json({ success: true, applications: enriched })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch vendor applications' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireRoles(request, ['admin'])
  if (response || !user) return response || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json().catch(() => ({}))
    const action = String(body?.action || '').trim().toLowerCase()
    const applicationId = String(body?.applicationId || '').trim()
    const rejectionReason = String(body?.rejectionReason || '').trim()

    if (!applicationId) {
      return NextResponse.json({ success: false, error: 'applicationId is required' }, { status: 400 })
    }
    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ success: false, error: 'action must be "approve" or "reject"' }, { status: 400 })
    }

    await connectToDatabase()

    // Guarded on status: 'pending' so two admins can't both process the same
    // application — the second one just gets modifiedCount: 0 and a clear 409.
    const update: Record<string, unknown> = {
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewedAt: new Date(),
      reviewedBy: user.id,
    }
    if (action === 'reject') {
      update.rejectionReason = rejectionReason || 'Not specified'
    }

    const result = await VendorApplication.updateOne(
      { _id: applicationId, status: 'pending' },
      { $set: update }
    )

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Application not found or already reviewed' },
        { status: 409 }
      )
    }

    if (action === 'approve') {
      const application: any = await VendorApplication.findById(applicationId).lean()
      const profileUpdate = await updateUserProfileInDb(String(application?.userId || ''), {
        role: 'vendor',
        vendorInfo: {
          businessType: application?.vendorType || 'both',
          businessName: '',
          isApproved: true,
        },
      })

      if (!profileUpdate.success) {
        return NextResponse.json(
          { success: false, error: 'Application approved but the account role update failed' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[admin/vendor-applications] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to process vendor application' },
      { status: 500 }
    )
  }
}
