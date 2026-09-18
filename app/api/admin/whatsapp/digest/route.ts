import { NextRequest, NextResponse } from 'next/server'
import { requireCronOrAdminAccess } from '@/lib/server-route-auth'
import { buildDigest, formatDigestForWhatsApp } from '@/lib/whatsapp/digest'
import { sendTextMessage } from '@/lib/whatsapp/client'

// Daily bot report. GET returns JSON (admin session or CRON_SECRET bearer); ?send=1 also
// posts the WhatsApp-formatted summary to SUPPORT_WHATSAPP_NUMBER — that's what the
// Vercel cron does each morning. ?hours=N changes the window (default 24).
export async function GET(request: NextRequest) {
  const denied = await requireCronOrAdminAccess(request)
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  const hours = Math.min(24 * 30, Math.max(1, Number(searchParams.get('hours') || 24)))
  const digest = await buildDigest(hours)
  const text = formatDigestForWhatsApp(digest)

  let sent = false
  if (searchParams.get('send') === '1') {
    const to = String(process.env.SUPPORT_WHATSAPP_NUMBER || '').replace(/\D/g, '')
    if (to) {
      try {
        await sendTextMessage(to, text)
        sent = true
      } catch (error) {
        console.error('[whatsapp-digest] send failed:', error)
      }
    }
  }
  return NextResponse.json({ success: true, sent, digest, text })
}
