import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { requireAdminAccess } from '@/lib/server-route-auth'
import { emailService } from '@/lib/email'
import mongoose from 'mongoose'

const LOGISTICS_TARGETS = [
  { email: 'Kingmishi456@gmail.com', logisticsName: 'A&CO Logistics' },
  { email: 'Orahlogistics@gmail.com', logisticsName: 'Orah Logistics' },
]

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    const { action, testOnly = false } = await request.json()

    if (!['vendor', 'logistics', 'both'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'action must be "vendor", "logistics", or "both"' },
        { status: 400 }
      )
    }

    await connectToDatabase()

    const TEST_EMAIL = 'arnoldeee123@gmail.com'
    const results: { type: string; email: string; sent: boolean; error?: string }[] = []

    const sendVendor = action === 'vendor' || action === 'both'
    const sendLogistics = action === 'logistics' || action === 'both'

    if (sendVendor) {
      if (testOnly) {
        try {
          const sent = await emailService.sendVendorCampaignEmail({ email: TEST_EMAIL, name: 'Test Vendor' })
          results.push({ type: 'vendor-test', email: TEST_EMAIL, sent })
        } catch (err: any) {
          results.push({ type: 'vendor-test', email: TEST_EMAIL, sent: false, error: err?.message })
        }
      } else {
        // Find all vendors that have at least one store
        const storeCollection = mongoose.connection.db!.collection('stores')
        const vendorIdsWithStores = await storeCollection
          .distinct('vendorId', { vendorId: { $exists: true, $ne: null } })

        const vendorObjectIds = vendorIdsWithStores
          .map((id: any) => {
            try { return new mongoose.Types.ObjectId(String(id)) } catch { return null }
          })
          .filter(Boolean)

        const vendors = await User.find({
          _id: { $in: vendorObjectIds },
          role: 'vendor',
          email: { $exists: true, $ne: '' },
        }).select('_id email name displayName')

        for (const vendor of vendors as any[]) {
          const name = vendor.name || vendor.displayName || 'Vendor'
          try {
            const sent = await emailService.sendVendorCampaignEmail({ email: vendor.email, name })
            results.push({ type: 'vendor', email: vendor.email, sent })
          } catch (err: any) {
            results.push({ type: 'vendor', email: vendor.email, sent: false, error: err?.message })
          }
        }
      }
    }

    if (sendLogistics) {
      if (testOnly) {
        try {
          const sent = await emailService.sendLogisticsCampaignEmail({ email: TEST_EMAIL, logisticsName: 'Test Logistics' })
          results.push({ type: 'logistics-test', email: TEST_EMAIL, sent })
        } catch (err: any) {
          results.push({ type: 'logistics-test', email: TEST_EMAIL, sent: false, error: err?.message })
        }
      } else {
        for (const target of LOGISTICS_TARGETS) {
          try {
            const sent = await emailService.sendLogisticsCampaignEmail({ email: target.email, logisticsName: target.logisticsName })
            results.push({ type: 'logistics', email: target.email, sent })
          } catch (err: any) {
            results.push({ type: 'logistics', email: target.email, sent: false, error: err?.message })
          }
        }
      }
    }

    const sentCount = results.filter(r => r.sent).length
    const failedCount = results.filter(r => !r.sent).length

    return NextResponse.json({
      success: true,
      testOnly,
      sent: sentCount,
      failed: failedCount,
      results,
    })
  } catch (error: any) {
    console.error('[admin/campaign-email] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
