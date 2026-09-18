import { NextRequest, NextResponse } from 'next/server'
import { requireCronOrAdminAccess } from '@/lib/server-route-auth'
import { sendReviewPrompts, sendBackInStockAlerts } from '@/lib/whatsapp/proactive'

// Daily proactive sends: review prompts for orders received 2+ days ago, and
// back-in-stock alerts. Cron-scheduled in vercel.json; admins can call it by hand.
export async function GET(request: NextRequest) {
  const denied = await requireCronOrAdminAccess(request)
  if (denied) return denied
  const [reviews, stock] = await Promise.all([sendReviewPrompts(), sendBackInStockAlerts()])
  return NextResponse.json({ success: true, reviewPrompts: reviews.sent, backInStock: stock.sent })
}
