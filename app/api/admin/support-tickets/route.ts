import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { SupportTicket } from '@/lib/models/SupportTicket'
import { requireAdminAccess } from '@/lib/server-route-auth'

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  await connectToDatabase()

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')

  const query: Record<string, any> = {}
  if (status && status !== 'all') query.status = status
  if (priority && priority !== 'all') query.priority = priority

  const tickets = await SupportTicket.find(query).sort({ updatedAt: -1 }).limit(200).lean()

  return NextResponse.json({
    tickets: tickets.map((t: any) => ({ ...t, id: String(t._id) })),
  })
}
