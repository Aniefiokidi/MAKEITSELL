import { NextResponse } from 'next/server';
import { getConversations } from '@/lib/mongodb-operations';
import { NextRequest } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/server-route-auth';

export async function GET(req: NextRequest) {
  const sessionUser = await getSessionUserFromRequest(req)
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url);
  const role = searchParams.get('role');
  if (!role) {
    return NextResponse.json({ error: 'Missing role' }, { status: 400 });
  }

  if (role !== 'customer' && role !== 'provider') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  if (sessionUser.role === 'vendor' && role !== 'provider') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (sessionUser.role !== 'vendor' && role !== 'customer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const conversations = await getConversations(String(sessionUser.id), role as 'customer' | 'provider');
    return NextResponse.json({ conversations });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}
