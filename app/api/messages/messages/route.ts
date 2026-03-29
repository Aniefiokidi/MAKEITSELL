import { NextResponse } from 'next/server';
import { getChatMessages } from '@/lib/mongodb-operations';
import { NextRequest } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/server-route-auth';
import connectToDatabase from '@/lib/mongodb';
import ConversationModel from '@/lib/models/Conversation';

export async function GET(req: NextRequest) {
  const sessionUser = await getSessionUserFromRequest(req)
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get('conversationId');
  const limitCount = searchParams.get('limitCount');
  if (!conversationId) {
    return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 });
  }

  try {
    await connectToDatabase()
    const conversation = await ConversationModel.findById(conversationId)
      .select('customerId providerId')
      .lean() as any

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const isCustomer = String(conversation.customerId || '') === String(sessionUser.id)
    const isProvider = String(conversation.providerId || '') === String(sessionUser.id)
    if (!isCustomer && !isProvider) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const userRole = isProvider ? 'provider' : 'customer'
    const messages = await getChatMessages(
      conversationId,
      limitCount ? Number(limitCount) : undefined,
      String(sessionUser.id),
      userRole
    );
    return NextResponse.json({ messages });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}
