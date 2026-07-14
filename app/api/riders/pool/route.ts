import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { logisticsEmailAllowedForRegion, resolveLogisticsRegion } from '@/lib/logistics-access'

export async function GET(request: NextRequest) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const region = resolveLogisticsRegion(request.nextUrl.searchParams.get('region'))
  if (!logisticsEmailAllowedForRegion(sessionUser.email, region)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  await connectToDatabase()

  const riders = await User.find({
    role: 'rider',
    'riderInfo.region': region.key,
  })
    .select('name email phone riderInfo')
    .lean()

  const results = (riders as any[]).map((rider) => ({
    id: String(rider._id),
    name: rider.name || rider.email,
    phone: rider.phone || '',
    vehicleType: rider.riderInfo?.vehicleType || 'bike',
    isActive: rider.riderInfo?.isActive !== false,
  }))

  return NextResponse.json({ success: true, region: region.key, riders: results })
}
