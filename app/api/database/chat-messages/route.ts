import { NextRequest, NextResponse } from 'next/server';
import { createChatMessage } from '@/lib/mongodb-operations';
import { getSessionUserFromRequest } from '@/lib/server-route-auth';

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(req);
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    // Always the caller's own session — the real, live messaging path is
    // /api/messages/send (already correctly secured); this route accepted an arbitrary
    // senderId/conversationId from the body with no auth at all.
    const messageId = await createChatMessage({ ...body, senderId: sessionUser.id });
    return NextResponse.json({ success: true, data: messageId });
  } catch (error: any) {
    console.error('API /api/database/chat-messages error:', error);
    return NextResponse.json({ success: false, error: error?.message || error }, { status: 500 });
  }
}

// Optionally, implement GET or other methods if needed
