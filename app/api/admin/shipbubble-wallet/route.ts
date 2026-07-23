import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/server-route-auth'
import { getShipbubbleWalletBalance } from '@/lib/shipbubble'

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  const wallet = await getShipbubbleWalletBalance()
  if (!wallet) {
    return NextResponse.json({ success: false, error: 'Could not reach Shipbubble' }, { status: 502 })
  }

  return NextResponse.json({ success: true, balance: wallet.balance, currency: wallet.currency })
}
