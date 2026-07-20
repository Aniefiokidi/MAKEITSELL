import { NextRequest, NextResponse } from 'next/server'
import { getConversations, createConversation } from '@/lib/mongodb-operations'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'

// GET /api/database/conversations?userId=...&role=...
export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const role = searchParams.get('role')
    if (!userId || !role) {
      return NextResponse.json({ success: false, error: 'Missing userId or role' }, { status: 400 })
    }

    if (role !== 'customer' && role !== 'provider') {
      return NextResponse.json({ success: false, error: 'Invalid role' }, { status: 400 })
    }

    // Conversation previews include the last message text — only the participant
    // themselves (or an admin) should be able to read that.
    if (userId !== sessionUser.id && sessionUser.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const conversations = await getConversations(userId, role)
    return NextResponse.json({ success: true, data: conversations })
  } catch (error: any) {
    console.error('Get conversations error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch conversations' }, { status: 500 })
  }
}

// POST /api/database/conversations
export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    // Always the caller's own side of the conversation — never trust customerId/providerId
    // from the body. Whichever side the session belongs to gets forced; the other side is
    // whoever the client says they're messaging (unchanged — that's just who the
    // conversation is with, not a privilege).
    if (sessionUser.role === 'vendor') {
      data.providerId = sessionUser.id
    } else {
      data.customerId = sessionUser.id
    }

    const conversation = await createConversation(data)
    return NextResponse.json({ success: true, data: { id: conversation._id.toString(), ...conversation.toObject?.() } })
  } catch (error: any) {
    console.error('Create conversation error:', error)
    return NextResponse.json({ success: false, error: error?.message || error }, { status: 500 })
  }
}
