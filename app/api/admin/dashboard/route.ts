import { NextRequest } from 'next/server'
import { getGlobalDashboard } from '@/lib/global-dashboard'
import { requireAdminAccess } from '@/lib/server-route-auth'

export async function GET(req: NextRequest) {
  const unauthorized = await requireAdminAccess(req)
  if (unauthorized) return unauthorized

  try {
    const data = await getGlobalDashboard()
    return new Response(JSON.stringify({ success: true, data }), { status: 200 })
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error?.message || 'Unknown error' }), { status: 500 })
  }
}
