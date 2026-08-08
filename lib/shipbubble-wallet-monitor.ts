// Semi-automatic Shipbubble wallet top-up: monitors the balance and, when it's low, auto-
// generates a fresh funding link and alerts an admin to approve it with one tap — the
// closest thing to "fully automatic" actually achievable from MakeItSell's side.
//
// Why not fully automatic: Shipbubble's requestShipbubbleWalletFund (lib/shipbubble.ts)
// always returns a Paystack checkout URL on SHIPBUBBLE'S OWN merchant account, never a
// direct charge. Paystack authorization codes are scoped to the specific integration
// that captured them (confirmed against Paystack's own docs), so a card saved through
// MakeItSell's Paystack integration cannot be reused to pay into Shipbubble's. Completing
// payment_url always needs either a human, or Shipbubble itself offering save-a-card +
// auto-recharge on THEIR dashboard (checked — their public API docs show no such
// endpoint; if their dashboard has it as a UI-only feature, that would fully replace this
// file's alerting, but couldn't be confirmed from outside their product).
import connectToDatabase from '@/lib/mongodb'
import { AdminSetting } from '@/lib/models/AdminSetting'
import { getShipbubbleWalletBalance, requestShipbubbleWalletFund } from '@/lib/shipbubble'
import { emailService } from '@/lib/email'
import { sendTextMessage } from '@/lib/whatsapp/client'

const LAST_ALERT_SETTING_KEY = 'shipbubble_wallet_last_alert_at'

function getThreshold(): number {
  const configured = Number(process.env.SHIPBUBBLE_WALLET_LOW_BALANCE_THRESHOLD)
  return Number.isFinite(configured) && configured > 0 ? configured : 5000
}

function getTopupAmount(): number {
  const configured = Number(process.env.SHIPBUBBLE_WALLET_TOPUP_AMOUNT)
  return Number.isFinite(configured) && configured > 0 ? configured : 20000
}

function getCooldownHours(): number {
  const configured = Number(process.env.SHIPBUBBLE_WALLET_ALERT_COOLDOWN_HOURS)
  return Number.isFinite(configured) && configured > 0 ? configured : 6
}

function getAlertEmail(): string {
  return String(process.env.SHIPBUBBLE_WALLET_ALERT_EMAIL || 'arnoldeee123@gmail.com').trim()
}

function getAlertWhatsApp(): string {
  return String(process.env.SHIPBUBBLE_WALLET_ALERT_WHATSAPP || '2347055590445').trim()
}

function formatNaira(amount: number): string {
  return `NGN ${Math.max(0, Number(amount) || 0).toLocaleString('en-NG')}`
}

export type ShipbubbleWalletCheckResult =
  | { checked: false; reason: string }
  | {
      checked: true
      balance: number
      belowThreshold: boolean
      alertSent: boolean
      reason?: string
      emailFailed?: boolean
      whatsappFailed?: boolean
      whatsappError?: string
    }

// Deliberately re-alerts every cooldown window while the balance STAYS low, rather than a
// one-shot alert on first crossing the threshold (the pattern lib/stock-alerts.ts uses for
// vendors). A missed/ignored low-stock alert only costs a vendor sales; a missed low
// Shipbubble balance blocks real deliveries platform-wide, so repeat reminders until it's
// actually resolved are the right call here, not a single alert that's easy to lose in an
// inbox.
export async function checkAndAlertShipbubbleWallet(): Promise<ShipbubbleWalletCheckResult> {
  const wallet = await getShipbubbleWalletBalance()
  if (!wallet) {
    return { checked: false, reason: 'Could not reach Shipbubble to check balance' }
  }

  const threshold = getThreshold()
  if (wallet.balance > threshold) {
    return { checked: true, balance: wallet.balance, belowThreshold: false, alertSent: false }
  }

  await connectToDatabase()
  const cooldownMs = getCooldownHours() * 60 * 60 * 1000
  const lastAlertSetting: any = await AdminSetting.findOne({ key: LAST_ALERT_SETTING_KEY }).lean()
  const lastAlertAt = lastAlertSetting?.value ? new Date(lastAlertSetting.value).getTime() : 0

  if (lastAlertAt && Date.now() - lastAlertAt < cooldownMs) {
    return { checked: true, balance: wallet.balance, belowThreshold: true, alertSent: false, reason: 'Within cooldown window since last alert' }
  }

  const topupAmount = getTopupAmount()
  const funding = await requestShipbubbleWalletFund(topupAmount)
  if (!funding) {
    return { checked: true, balance: wallet.balance, belowThreshold: true, alertSent: false, reason: 'Failed to generate a Shipbubble funding link' }
  }

  const subject = `Shipbubble wallet low: ${formatNaira(wallet.balance)} left`
  const message = `Shipbubble delivery wallet is low: ${formatNaira(wallet.balance)} remaining (threshold ${formatNaira(threshold)}).\n\nTap to top up ${formatNaira(topupAmount)}:\n${funding.paymentUrl}\n\nThis is Shipbubble's own checkout — your saved card there should make this quick.`

  const email = getAlertEmail()
  const whatsapp = getAlertWhatsApp()

  const [emailResult, whatsappResult] = await Promise.allSettled([
    email
      ? emailService.sendEmail({
          to: email,
          subject,
          html: `<p>${message.replace(/\n/g, '<br/>')}</p>`,
          text: message,
        })
      : Promise.resolve(),
    whatsapp ? sendTextMessage(whatsapp, message) : Promise.resolve(),
  ])

  // Neither send is allowed to throw past this point (Promise.allSettled guarantees
  // that), but a silently-swallowed failure is exactly how "email arrived, WhatsApp
  // didn't" goes unnoticed — every other send in this codebase logs through a trySendX
  // wrapper for the same reason; this didn't, which is exactly the gap that needs fixing.
  const emailFailed = emailResult.status === 'rejected' || (emailResult.status === 'fulfilled' && emailResult.value === false)
  const whatsappFailed = whatsappResult.status === 'rejected'
  if (emailFailed) {
    console.error('[shipbubble-wallet-monitor] Email alert failed:', emailResult.status === 'rejected' ? emailResult.reason : 'sendEmail returned false')
  }
  if (whatsappFailed) {
    // Almost always Meta's 24h customer-service window: a free-form text (as opposed to
    // an approved template) can only be delivered to a number that has messaged the
    // bot's business number within the last 24h. The admin alert number has likely never
    // messaged it at all. See the return value's whatsappError for the exact reason.
    console.error('[shipbubble-wallet-monitor] WhatsApp alert failed:', (whatsappResult as PromiseRejectedResult).reason)
  }

  await AdminSetting.findOneAndUpdate(
    { key: LAST_ALERT_SETTING_KEY },
    { $set: { value: new Date().toISOString() } },
    { upsert: true }
  )

  console.log(`[shipbubble-wallet-monitor] Low balance (${wallet.balance}) — alert sent (email ${emailFailed ? 'FAILED' : 'ok'}, whatsapp ${whatsappFailed ? 'FAILED' : 'ok'}), funding link generated`)
  return {
    checked: true,
    balance: wallet.balance,
    belowThreshold: true,
    alertSent: true,
    emailFailed,
    whatsappFailed,
    whatsappError: whatsappFailed ? String((whatsappResult as PromiseRejectedResult).reason?.message || (whatsappResult as PromiseRejectedResult).reason) : undefined,
  }
}
