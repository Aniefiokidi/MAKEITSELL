import { NextRequest, NextResponse } from 'next/server';
import { requireRoles } from '@/lib/server-route-auth';
import connectToDatabase from '@/lib/mongodb';
import { Store } from '@/lib/models/Store';
import { POST as createStore } from '@/app/api/database/stores/route';
export async function POST(request: NextRequest) {
  const { user, response } = await requireRoles(request, ['vendor', 'admin']);
  if (response || !user) return response!;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ success: false, error: 'Invalid store data' }, { status: 400 });
  const headers = new Headers(request.headers); headers.delete('content-length');
  return createStore(new NextRequest(request.url, { method: 'POST', headers, body: JSON.stringify({ ...body, vendorId: user.id, linkedWalletUserId: user.id }) }));
}
export async function GET(request: NextRequest) {
  const { user, response } = await requireRoles(request, ['vendor', 'admin']);
  if (response || !user) return response!;
  try {
    await connectToDatabase();
    const stores = await Store.find({ vendorId: user.id }).sort({ _id: 1 }).lean();
    return NextResponse.json({ success: true, data: stores.map((s: any) => ({ ...s, id: String(s._id), location: s.address || '', bannerImage: s.backgroundImage || s.storeImage })), multiStoreVersion: 1 }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ success: false, error: 'Could not load stores' }, { status: 500 }); }
}
