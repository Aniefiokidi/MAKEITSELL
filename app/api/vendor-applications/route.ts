import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { VendorApplication } from '@/lib/models/VendorApplication'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'

const VENDOR_TYPES = ['goods', 'services', 'both']

export async function POST(request: NextRequest) {
  const user = await getSessionUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const vendorType = String(body?.vendorType || '').trim()
    const whatTheyPlanToSell = String(body?.whatTheyPlanToSell || '').trim()
    const expectedMonthlyIncome = String(body?.expectedMonthlyIncome || '').trim()
    const nin = String(body?.nin || '').trim()
    const proofOfAddressUrl = String(body?.proofOfAddressUrl || '').trim()

    if (!VENDOR_TYPES.includes(vendorType)) {
      return NextResponse.json({ success: false, error: 'Invalid vendor type' }, { status: 400 })
    }
    if (!whatTheyPlanToSell) {
      return NextResponse.json({ success: false, error: 'Tell us what you plan to sell' }, { status: 400 })
    }
    if (!expectedMonthlyIncome) {
      return NextResponse.json({ success: false, error: 'Expected monthly income is required' }, { status: 400 })
    }
    if (!/^\d{11}$/.test(nin)) {
      return NextResponse.json({ success: false, error: 'NIN must be exactly 11 digits' }, { status: 400 })
    }
    if (!proofOfAddressUrl) {
      return NextResponse.json({ success: false, error: 'Proof of address is required' }, { status: 400 })
    }

    await connectToDatabase()

    const existingPending = await VendorApplication.findOne({ userId: user.id, status: 'pending' }).lean()
    if (existingPending) {
      return NextResponse.json(
        { success: false, error: 'You already have an application under review' },
        { status: 409 }
      )
    }

    const application = await VendorApplication.create({
      userId: user.id,
      status: 'pending',
      vendorType,
      whatTheyPlanToSell,
      expectedMonthlyIncome,
      nin,
      proofOfAddressUrl,
      submittedAt: new Date(),
    })

    return NextResponse.json({ success: true, application })
  } catch (error: any) {
    console.error('[vendor-applications] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Could not submit application' },
      { status: 500 }
    )
  }
}
