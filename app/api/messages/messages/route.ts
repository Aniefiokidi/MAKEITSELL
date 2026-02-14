import { NextResponse } from 'next/server';
import { getChatMessages } from '@/lib/mongodb-operations';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get('conversationId');
  const limitCount = searchParams.get('limitCount');
  const userId = searchParams.get('userId');
  const userRole = searchParams.get('userRole');
  if (!conversationId) {
    return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 });
  }
  try {
    const messages = await getChatMessages(
      conversationId,
      limitCount ? Number(limitCount) : undefined,
      userId,
      userRole
    );
    return NextResponse.json({ messages });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}
