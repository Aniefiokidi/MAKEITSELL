import { NextResponse } from 'next/server';
import { createChatMessage } from '@/lib/mongodb-operations';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messageId = await createChatMessage(body);
    return NextResponse.json({ success: true, data: messageId });
  } catch (error) {
    console.error('API /api/database/chat-messages error:', error);
    return NextResponse.json({ success: false, error: error?.message || error }, { status: 500 });
  }
}

// Optionally, implement GET or other methods if needed
