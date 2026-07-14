import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { RiderAssignment } from '@/lib/models/RiderAssignment'
import { User } from '@/lib/models/User'
import { haversineDistanceMeters } from '@/lib/geo'
import { estimateEtaMinutes } from '@/lib/eta'

export async function GET(request: NextRequest, context: { params: Promise<{ trackingToken: string }> }) {
  const { trackingToken } = await context.params

  if (!trackingToken) {
    return NextResponse.json({ success: false, error: 'Invalid tracking link' }, { status: 400 })
  }

  await connectToDatabase()

  const assignment = await RiderAssignment.findOne({ trackingToken }).lean() as any
  if (!assignment) {
    return NextResponse.json({ success: false, error: 'Tracking link not found' }, { status: 404 })
  }

  const rider = await User.findById(assignment.riderId).lean() as any
  const riderLocation = rider?.riderInfo?.currentLocation || null

  const firstName = String(assignment.riderName || 'Your rider').split(' ')[0]
  const lastInitial = String(assignment.riderName || '').split(' ')[1]?.charAt(0)
  const riderDisplayName = lastInitial ? `${firstName} ${lastInitial}.` : firstName

  let distanceMeters: number | null = null
  let etaMinutes: number | null = null
  if (riderLocation && Number.isFinite(riderLocation.lat) && Number.isFinite(riderLocation.lng)) {
    distanceMeters = haversineDistanceMeters(
      { lat: riderLocation.lat, lng: riderLocation.lng },
      { lat: assignment.destination.lat, lng: assignment.destination.lng }
    )
    etaMinutes = estimateEtaMinutes(distanceMeters)
  }

  return NextResponse.json({
    success: true,
    status: assignment.status,
    orderShortId: String(assignment.orderId || '').substring(0, 8).toUpperCase(),
    riderName: riderDisplayName,
    riderLocation: riderLocation ? { lat: riderLocation.lat, lng: riderLocation.lng, updatedAt: riderLocation.updatedAt } : null,
    destination: { lat: assignment.destination.lat, lng: assignment.destination.lng, address: assignment.destination.address },
    geofenceRadiusMeters: assignment.geofenceRadiusMeters,
    distanceMeters,
    etaMinutes,
  })
}
