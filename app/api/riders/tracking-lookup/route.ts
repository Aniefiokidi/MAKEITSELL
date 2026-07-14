import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { RiderAssignment } from '@/lib/models/RiderAssignment'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'

export async function GET(request: NextRequest) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const rowIdsParam = String(request.nextUrl.searchParams.get('rowIds') || '').trim()
  const rowIds = rowIdsParam.split(',').map((v) => v.trim()).filter(Boolean)

  if (rowIds.length === 0) {
    return NextResponse.json({ success: true, tracking: {} })
  }

  await connectToDatabase()

  const assignments = await RiderAssignment.find({
    rowId: { $in: rowIds },
    customerId: sessionUser.id,
  })
    .select('rowId trackingToken status')
    .lean()

  const tracking: Record<string, { trackingToken: string; status: string }> = {}
  for (const assignment of assignments as any[]) {
    tracking[assignment.rowId] = { trackingToken: assignment.trackingToken, status: assignment.status }
  }

  return NextResponse.json({ success: true, tracking })
}
