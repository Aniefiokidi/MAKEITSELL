
import { NextRequest, NextResponse } from 'next/server';

// Disabled in this deployment: no server-side session model available
export async function POST(req: NextRequest) {
  return NextResponse.json(
    { success: false, error: 'Profile update not implemented in this deployment' },
    { status: 501 }
  );
}
