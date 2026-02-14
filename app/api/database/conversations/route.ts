import { NextRequest, NextResponse } from 'next/server'
import { getConversations, createConversation } from '@/lib/mongodb-operations'

// GET /api/database/conversations?userId=...&role=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const role = searchParams.get('role')
    if (!userId || !role) {
      return NextResponse.json({ success: false, error: 'Missing userId or role' }, { status: 400 })
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
    const data = await request.json()
    const conversation = await createConversation(data)
    return NextResponse.json({ success: true, data: { id: conversation._id.toString(), ...conversation.toObject?.() } })
  } catch (error: any) {
    console.error('Create conversation error:', error)
    return NextResponse.json({ success: false, error: error?.message || error }, { status: 500 })
  }
}
