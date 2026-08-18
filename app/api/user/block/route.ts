import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import connectToDatabase from '@/lib/mongodb'
import { UserBlock } from '@/lib/models/UserBlock'

export async function GET(req: NextRequest) {
  const sessionUser = await getSessionUserFromRequest(req)
  if (!sessionUser) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  await connectToDatabase()
  const blocks = await UserBlock.find({ blockerId: String(sessionUser.id) }).sort({ createdAt: -1 }).lean()
  return NextResponse.json({
    success: true,
    blocked: blocks.map((b: any) => ({
      userId: b.blockedUserId,
      name: b.blockedUserName || '',
      blockedAt: b.createdAt,
    })),
  })
}

export async function POST(req: NextRequest) {
  const sessionUser = await getSessionUserFromRequest(req)
  if (!sessionUser) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const blockedUserId = String(body?.blockedUserId || '').trim()
  const blockedUserName = body?.blockedUserName ? String(body.blockedUserName) : undefined
  if (!blockedUserId) {
    return NextResponse.json({ success: false, error: 'blockedUserId is required' }, { status: 400 })
  }
  if (blockedUserId === String(sessionUser.id)) {
    return NextResponse.json({ success: false, error: "You can't block yourself" }, { status: 400 })
  }

  await connectToDatabase()
  await UserBlock.updateOne(
    { blockerId: String(sessionUser.id), blockedUserId },
    { $setOnInsert: { blockerId: String(sessionUser.id), blockedUserId, blockedUserName, createdAt: new Date() } },
    { upsert: true }
  )

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const sessionUser = await getSessionUserFromRequest(req)
  if (!sessionUser) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const blockedUserId = String(searchParams.get('blockedUserId') || '').trim()
  if (!blockedUserId) {
    return NextResponse.json({ success: false, error: 'blockedUserId is required' }, { status: 400 })
  }

  await connectToDatabase()
  await UserBlock.deleteOne({ blockerId: String(sessionUser.id), blockedUserId })
  return NextResponse.json({ success: true })
}
