import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { RiderAssignment } from '@/lib/models/RiderAssignment'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { logisticsEmailAllowedForRegion, resolveLogisticsRegion, storeMatchesLogisticsRegion } from '@/lib/logistics-access'
import { resolveOrderVendorTarget } from '@/lib/order-vendor-status'
import { pushToUser } from '@/lib/push-notifications'
import { emailService } from '@/lib/email'
import { getCanonicalAppBaseUrl } from '@/lib/app-url'

export async function GET(request: NextRequest) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const region = resolveLogisticsRegion(request.nextUrl.searchParams.get('region'))
  if (!logisticsEmailAllowedForRegion(sessionUser.email, region)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const rowId = String(request.nextUrl.searchParams.get('rowId') || '').trim()
  if (!rowId) {
    return NextResponse.json({ success: false, error: 'rowId is required' }, { status: 400 })
  }

  await connectToDatabase()
  const assignment = await RiderAssignment.findOne({ rowId }).lean()

  return NextResponse.json({ success: true, assignment: assignment || null })
}

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const region = resolveLogisticsRegion(body?.region)

    if (!logisticsEmailAllowedForRegion(sessionUser.email, region)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const orderId = String(body?.orderId || '').trim()
    const vendorId = String(body?.vendorId || '').trim()
    const storeId = String(body?.storeId || '').trim()
    const riderId = String(body?.riderId || '').trim()
    const destination = body?.destination

    if (!orderId || !riderId) {
      return NextResponse.json({ success: false, error: 'orderId and riderId are required' }, { status: 400 })
    }

    const lat = Number(destination?.lat)
    const lng = Number(destination?.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ success: false, error: 'A valid destination pin is required' }, { status: 400 })
    }

    const target = await resolveOrderVendorTarget(orderId, vendorId, storeId)
    if (!target) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    const { existingOrder, targetStore } = target

    if (!storeMatchesLogisticsRegion(targetStore, region)) {
      return NextResponse.json({ success: false, error: `Only ${region.cityLabel} orders can be managed here` }, { status: 400 })
    }

    await connectToDatabase()

    const rider = await User.findById(riderId).lean() as any
    if (!rider || rider.role !== 'rider' || String(rider.riderInfo?.region || '') !== region.key) {
      return NextResponse.json({ success: false, error: 'Rider not found in this region' }, { status: 400 })
    }

    const rowId = `${orderId}:${vendorId || storeId || ''}`
    const customerId = String((existingOrder as any)?.customerId || '')

    const now = new Date()
    const assignment = await RiderAssignment.findOneAndUpdate(
      { rowId },
      {
        $set: {
          orderId,
          vendorId,
          storeId,
          region: region.key,
          customerId,
          riderId,
          riderName: rider.name || rider.email,
          riderPhone: rider.phone || '',
          assignedByEmail: sessionUser.email,
          status: 'assigned',
          destination: {
            lat,
            lng,
            address: String(destination?.address || ''),
            source: destination?.source === 'manual' ? 'manual' : 'geocode',
          },
          assignedAt: now,
          pickedUpAt: null,
          enRouteAt: null,
          arrivedAt: null,
          deliveredAt: null,
          arrivalNotifiedAt: null,
          updatedAt: now,
        },
        $setOnInsert: {
          trackingToken: crypto.randomBytes(24).toString('hex'),
          geofenceRadiusMeters: 200,
          createdAt: now,
        },
      },
      { upsert: true, new: true }
    )

    const appBase = getCanonicalAppBaseUrl(request.headers.get('origin'))
    const trackingUrl = `${appBase}/track/${assignment.trackingToken}`

    if (customerId) {
      try {
        const customer = await User.findById(customerId).lean() as any
        const customerEmail = String((existingOrder as any)?.shippingInfo?.email || customer?.email || '')
        const customerName = String(customer?.name || (existingOrder as any)?.shippingInfo?.firstName || 'there')

        await pushToUser(customerId, {
          title: 'A rider is on the way',
          body: `${assignment.riderName} has been assigned to deliver order #${String(orderId).substring(0, 8).toUpperCase()}`,
          url: `/track/${assignment.trackingToken}`,
          tag: `rider-assigned-${assignment._id}`,
        })

        if (customerEmail) {
          await emailService.sendRiderAssignedEmail({
            to: customerEmail,
            customerName,
            orderId,
            riderName: assignment.riderName,
            trackingUrl,
          })
        }
      } catch (notifyErr) {
        console.error('[api/riders/assign] Notification failed:', notifyErr)
      }
    }

    return NextResponse.json({ success: true, assignment })
  } catch (error) {
    console.error('[api/riders/assign] Failed:', error)
    return NextResponse.json({ success: false, error: 'Failed to assign rider' }, { status: 500 })
  }
}
