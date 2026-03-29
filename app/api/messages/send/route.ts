import { NextResponse } from 'next/server';
import { createChatMessage } from '@/lib/mongodb-operations';
import { NextRequest } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/server-route-auth';
import connectToDatabase from '@/lib/mongodb';
import ConversationModel from '@/lib/models/Conversation';

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(req)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json();

    const senderRole = sessionUser.role === 'vendor' ? 'provider' : 'customer'
    const senderId = String(sessionUser.id)
    const senderName = sessionUser.name || ''

    if (!body?.conversationId || !body?.message) {
      return NextResponse.json({ error: 'conversationId and message are required' }, { status: 400 })
    }

    await connectToDatabase()
    const conversation = await ConversationModel.findById(body.conversationId)
      .select('customerId customerName providerId providerName')
      .lean() as any

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const isCustomer = String(conversation.customerId || '') === senderId
    const isProvider = String(conversation.providerId || '') === senderId
    if (!isCustomer && !isProvider) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const payload = {
      conversationId: body.conversationId,
      senderId,
      senderName,
      senderRole,
      receiverId: isProvider ? String(conversation.customerId) : String(conversation.providerId),
      receiverName: isProvider ? String(conversation.customerName || '') : String(conversation.providerName || ''),
      message: String(body.message),
      read: false,
    }

    const messageId = await createChatMessage(payload);
    return NextResponse.json({ messageId });
  } catch (error: any) {
    console.error('API /api/messages/send error:', error);
    return NextResponse.json({ error: 'Failed to send message', details: error?.message || error }, { status: 500 });
  }
}
