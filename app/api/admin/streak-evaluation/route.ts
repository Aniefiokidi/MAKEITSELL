import { NextRequest, NextResponse } from 'next/server'
import { requireCronOrAdminAccess } from '@/lib/server-route-auth'
import { evaluateMonthlyStreak } from '@/lib/streak/evaluateMonthlyStreak'

export async function POST(request: NextRequest) {
  const unauthorized = await requireCronOrAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    const summary = await evaluateMonthlyStreak()
    return NextResponse.json({ success: true, summary })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Streak evaluation failed' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
