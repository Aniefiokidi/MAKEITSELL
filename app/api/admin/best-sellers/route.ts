import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/server-route-auth'
import { getBestSellers, type BestSellerWindow } from '@/lib/best-sellers'

const VALID_WINDOWS = new Set(['7d', '30d', '90d', 'all'])

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(request.url)
  const rawWindow = searchParams.get('window') || '30d'
  const window = (VALID_WINDOWS.has(rawWindow) ? rawWindow : '30d') as BestSellerWindow

  try {
    const result = await getBestSellers(window)
    return NextResponse.json({ success: true, generatedAt: new Date().toISOString(), ...result })
  } catch (error: any) {
    console.error('[/api/admin/best-sellers]', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to load best sellers' },
      { status: 500 }
    )
  }
}
