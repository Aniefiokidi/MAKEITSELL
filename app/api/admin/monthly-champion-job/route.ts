import { NextRequest, NextResponse } from 'next/server'
import { requireCronOrAdminAccess } from '@/lib/server-route-auth'
import { evaluateMonthlyChampion } from '@/lib/champion/evaluateMonthlyChampion'

export async function POST(request: NextRequest) {
  const unauthorized = await requireCronOrAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    const result = await evaluateMonthlyChampion()
    return NextResponse.json({ success: true, result })
  } catch (error: any) {
    console.error('[monthly-champion-job] failed:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Champion evaluation failed' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
