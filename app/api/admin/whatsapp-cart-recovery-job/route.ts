import { NextRequest, NextResponse } from "next/server"
import { requireCronOrAdminAccess } from "@/lib/server-route-auth"
import { connectToDatabase } from "@/lib/mongodb"
import { WhatsAppBrowseState } from "@/lib/models/WhatsAppBrowseState"
import { sendWaNotification } from "@/lib/whatsapp/notify"

// The bot's own cart (WhatsAppBrowseState.cart, keyed by waId) is a completely separate,
// unrelated concept from the web Cart model app/api/admin/abandoned-cart-job targets
// (keyed by userId) — so this is its own job, not a hook into that one. Same 3–30 hour
// window for consistency (a once-daily cron needs a generous window so every abandoned
// cart is caught by exactly one run), and the same "skip if already nudged since the last
// update" re-fire guard as that job's recoveryEmailSentAt.
export async function POST(request: NextRequest) {
  const unauthorized = await requireCronOrAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    await connectToDatabase()
    const now = new Date()

    const windowStart = new Date(now.getTime() - 30 * 60 * 60 * 1000)
    const windowEnd = new Date(now.getTime() - 3 * 60 * 60 * 1000)

    const candidates = await WhatsAppBrowseState.find({
      updatedAt: { $gte: windowStart, $lte: windowEnd },
      "cart.0": { $exists: true },
    }).lean() as any[]

    let notified = 0

    for (const state of candidates) {
      const items = Array.isArray(state.cart) ? state.cart : []
      if (items.length === 0) continue

      if (state.cartRecoverySentAt && new Date(state.cartRecoverySentAt) >= new Date(state.updatedAt)) {
        continue
      }

      const itemCount = items.reduce((sum: number, i: any) => sum + Math.max(1, Number(i?.quantity || 1)), 0)
      const topItemTitle = String(items[0]?.title || "an item")

      await sendWaNotification({
        waId: state.waId,
        freeTextBody: `You left ${itemCount} item${itemCount === 1 ? "" : "s"} in your cart, including "${topItemTitle}" — reply "cart" to pick up where you left off.`,
        template: { name: "buyer_cart_recovery", params: [String(itemCount), topItemTitle] },
      })

      await WhatsAppBrowseState.updateOne({ _id: state._id }, { $set: { cartRecoverySentAt: now } })
      notified++
    }

    return NextResponse.json({ success: true, notified })
  } catch (error: any) {
    console.error("[whatsapp-cart-recovery-job] failed:", error)
    return NextResponse.json(
      { success: false, error: error.message || "WhatsApp cart recovery job failed" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
