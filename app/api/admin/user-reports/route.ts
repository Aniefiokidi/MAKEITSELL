import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/server-route-auth'
import connectToDatabase from '@/lib/mongodb'
import { UserReport } from '@/lib/models/UserReport'

// No admin UI reads UserReport anywhere yet (confirmed by grep across app/ and lib/) —
// the report/block feature (added for App Store Guideline 1.2) had a submit endpoint but
// nothing to review what gets submitted. This is that missing review queue.
export async function GET(req: NextRequest) {
  const unauthorized = await requireAdminAccess(req)
  if (unauthorized) return unauthorized

  await connectToDatabase()

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const query: Record<string, any> = {}
  if (status && status !== 'all') query.status = status

  const reports = await UserReport.find(query).sort({ createdAt: -1 }).limit(200).lean()

  return NextResponse.json({
    success: true,
    reports: reports.map((r: any) => ({ ...r, id: String(r._id) })),
  })
}

export async function PATCH(req: NextRequest) {
  const unauthorized = await requireAdminAccess(req)
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => ({}))
  const reportId = String(body?.reportId || '').trim()
  const status = String(body?.status || '').trim()

  if (!reportId || !['open', 'reviewed', 'dismissed'].includes(status)) {
    return NextResponse.json({ success: false, error: 'reportId and a valid status are required' }, { status: 400 })
  }

  await connectToDatabase()
  const updated = await UserReport.findByIdAndUpdate(reportId, { status }, { new: true }).lean()
  if (!updated) {
    return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, report: { ...(updated as any), id: String((updated as any)._id) } })
}
