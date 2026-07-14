import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { Order } from '@/lib/models/Order'
import { RiderAssignment } from '@/lib/models/RiderAssignment'
import { requireRoles } from '@/lib/server-route-auth'
import { haversineDistanceMeters } from '@/lib/geo'
import { pushToUser } from '@/lib/push-notifications'
import { emailService } from '@/lib/email'
import { getCanonicalAppBaseUrl } from '@/lib/app-url'

const MIN_PING_INTERVAL_MS = 8000

export async function POST(request: NextRequest) {
  const { user, response } = await requireRoles(request, ['rider'])
  if (response) return response

  const body = await request.json().catch(() => ({}))
  const lat = Number(body?.lat)
  const lng = Number(body?.lng)

  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return NextResponse.json({ success: false, error: 'Invalid coordinates' }, { status: 400 })
  }

  await connectToDatabase()

  const rider = await User.findById(user!.id).lean() as any
  const lastUpdatedAt = rider?.riderInfo?.currentLocation?.updatedAt
    ? new Date(rider.riderInfo.currentLocation.updatedAt).getTime()
    : 0

  if (Date.now() - lastUpdatedAt < MIN_PING_INTERVAL_MS) {
    return new NextResponse(null, { status: 204 })
  }

  const now = new Date()
  await User.updateOne(
    { _id: user!.id },
    { $set: { 'riderInfo.currentLocation': { lat, lng, updatedAt: now } } }
  )

  const activeAssignments = await RiderAssignment.find({
    riderId: user!.id,
    status: { $in: ['picked_up', 'en_route'] },
  })

  for (const assignment of activeAssignments) {
    if (assignment.arrivalNotifiedAt) continue

    const distance = haversineDistanceMeters(
      { lat, lng },
      { lat: assignment.destination.lat, lng: assignment.destination.lng }
    )

    if (distance <= (assignment.geofenceRadiusMeters || 200)) {
      assignment.status = 'arrived'
      assignment.arrivedAt = now
      assignment.arrivalNotifiedAt = now
      assignment.updatedAt = now
      await assignment.save()

      try {
        const appBase = getCanonicalAppBaseUrl(request.headers.get('origin'))
        const trackingUrl = `${appBase}/track/${assignment.trackingToken}`
        const riderName = assignment.riderName || rider?.name || 'Your rider'

        await pushToUser(assignment.customerId, {
          title: 'Your rider has arrived',
          body: `${riderName} is at your delivery location.`,
          url: `/track/${assignment.trackingToken}`,
          tag: `rider-arrived-${assignment._id}`,
        })

        const [customer, order] = await Promise.all([
          User.findById(assignment.customerId).lean() as Promise<any>,
          Order.findOne({ orderId: assignment.orderId }).lean() as Promise<any>,
        ])
        const customerEmail = customer?.email || order?.shippingInfo?.email
        if (customerEmail) {
          await emailService.sendRiderArrivedEmail({
            to: customerEmail,
            customerName: customer?.name || order?.shippingInfo?.firstName || 'there',
            orderId: assignment.orderId,
            riderName,
            trackingUrl,
          })
        }
      } catch (notifyErr) {
        console.error('[api/riders/location-ping] Arrival notification failed:', notifyErr)
      }
    }
  }

  return NextResponse.json({ success: true })
}
