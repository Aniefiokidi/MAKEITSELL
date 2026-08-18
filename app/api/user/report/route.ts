import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import connectToDatabase from '@/lib/mongodb'
import { UserReport, REPORT_REASONS } from '@/lib/models/UserReport'

export async function POST(req: NextRequest) {
  const sessionUser = await getSessionUserFromRequest(req)
  if (!sessionUser) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const reportedUserId = String(body?.reportedUserId || '').trim()
  const reason = String(body?.reason || '').trim()
  if (!reportedUserId) {
    return NextResponse.json({ success: false, error: 'reportedUserId is required' }, { status: 400 })
  }
  if (!REPORT_REASONS.includes(reason as any)) {
    return NextResponse.json({ success: false, error: 'A valid reason is required' }, { status: 400 })
  }
  if (reportedUserId === String(sessionUser.id)) {
    return NextResponse.json({ success: false, error: "You can't report yourself" }, { status: 400 })
  }

  await connectToDatabase()
  await UserReport.create({
    reporterId: String(sessionUser.id),
    reporterName: sessionUser.name || '',
    reportedUserId,
    reportedUserName: body?.reportedUserName ? String(body.reportedUserName) : undefined,
    reason,
    description: body?.description ? String(body.description).slice(0, 1000) : undefined,
    conversationId: body?.conversationId ? String(body.conversationId) : undefined,
  })

  return NextResponse.json({ success: true })
}
