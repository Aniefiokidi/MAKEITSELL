
import { NextRequest, NextResponse } from 'next/server';
import { updateUserProfileInDb } from '@/lib/mongodb-operations';
import { Session } from '@/lib/mongodb-auth';

export async function POST(req: NextRequest) {
  try {
    // Get session token from Authorization header
    const authHeader = req.headers.get('authorization');
    const sessionToken = authHeader?.replace('Bearer ', '');
    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    // Find session in DB
    const session = await Session.findOne({ sessionToken });
    if (!session) {
      return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 });
    }
    const { uid, displayName, email } = await req.json();
    if (!uid) {
      return NextResponse.json({ success: false, error: 'Missing user ID' }, { status: 400 });
    }
    // Only allow users to update their own profile
    if (session.userId !== uid) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }
    const update: any = {};
    if (displayName) update.displayName = displayName;
    if (email) update.email = email;
    const result = await updateUserProfileInDb(uid, update);
    if (!result) {
      return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
