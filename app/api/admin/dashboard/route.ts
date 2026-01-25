import { NextRequest } from 'next/server'
import { getGlobalDashboard } from '@/lib/global-dashboard'

export async function GET(req: NextRequest) {
  try {
    const data = await getGlobalDashboard()
    return new Response(JSON.stringify({ success: true, data }), { status: 200 })
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error?.message || 'Unknown error' }), { status: 500 })
  }
}
