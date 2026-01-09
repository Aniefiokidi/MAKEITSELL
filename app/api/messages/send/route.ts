import { NextResponse } from 'next/server';
import { createChatMessage } from '@/lib/database-client';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messageId = await createChatMessage(body);
    return NextResponse.json({ messageId });
  } catch (error) {
    console.error('API /api/messages/send error:', error);
    return NextResponse.json({ error: 'Failed to send message', details: error?.message || error }, { status: 500 });
  }
}
