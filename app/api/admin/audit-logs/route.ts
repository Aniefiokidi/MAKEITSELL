import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/server-route-auth'
import { connectToDatabase } from '@/lib/mongodb'
import { AdminAuditLog } from '@/lib/models/AdminAuditLog'

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    await connectToDatabase()

    const { searchParams } = new URL(request.url)
    const action = String(searchParams.get('action') || '').trim()
    const actor = String(searchParams.get('actor') || '').trim()
    const target = String(searchParams.get('target') || '').trim()
    const from = String(searchParams.get('from') || '').trim()
    const to = String(searchParams.get('to') || '').trim()

    const limitParam = Number.parseInt(searchParams.get('limit') || '100', 10)
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 10), 500) : 100

    const query: any = {}

    if (action) {
      query.action = action
    }

    if (actor) {
      query.actorEmail = { $regex: actor, $options: 'i' }
    }

    if (target) {
      query.targetUserEmail = { $regex: target, $options: 'i' }
    }

    if (from || to) {
      query.createdAt = {}
      if (from) {
        const fromDate = new Date(from)
        if (!Number.isNaN(fromDate.getTime())) {
          query.createdAt.$gte = fromDate
        }
      }
      if (to) {
        const toDate = new Date(to)
        if (!Number.isNaN(toDate.getTime())) {
          toDate.setHours(23, 59, 59, 999)
          query.createdAt.$lte = toDate
        }
      }
      if (Object.keys(query.createdAt).length === 0) {
        delete query.createdAt
      }
    }

    const rows = await AdminAuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()

    return NextResponse.json({
      success: true,
      data: rows.map((row: any) => ({
        id: row._id?.toString?.() || '',
        action: row.action,
        actorUserId: row.actorUserId,
        actorEmail: row.actorEmail,
        targetUserId: row.targetUserId,
        targetUserEmail: row.targetUserEmail,
        changes: row.changes || {},
        metadata: row.metadata || {},
        createdAt: row.createdAt,
      })),
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to fetch admin audit logs',
        data: [],
      },
      { status: 500 }
    )
  }
}
