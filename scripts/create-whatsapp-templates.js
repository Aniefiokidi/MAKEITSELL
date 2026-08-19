#!/usr/bin/env node
/**
 * Submits the WhatsApp message templates the bot needs to WhatsApp Business Manager for
 * review, via Meta's Graph API (POST /{WABA_ID}/message_templates). Covers the 7 templates
 * introduced across the negotiation (S4) and buyer/vendor-utility batches:
 *   buyer_booking_counter_received, provider_booking_counter_received,
 *   buyer_booking_reminder, provider_booking_reminder, buyer_cart_recovery,
 *   vendor_low_stock, vendor_review_received
 *
 * Every one of these is called from the codebase today via sendTemplateMessage(waId, name,
 * params) with a FIXED-LENGTH, FIXED-ORDER params array (lib/whatsapp/client.ts) — the
 * body text and variable count below must stay in exact sync with those call sites; see
 * each template's `// params:` comment for where it's used.
 *
 * Usage:
 *   node scripts/create-whatsapp-templates.js              ← dry run, prints what would be submitted
 *   node scripts/create-whatsapp-templates.js --live        ← actually submits to Meta for review
 *   node scripts/create-whatsapp-templates.js --live --only=buyer_cart_recovery   ← submit just one
 *
 * Requires WHATSAPP_ACCESS_TOKEN and WHATSAPP_BUSINESS_ACCOUNT_ID (the WABA id — NOT the
 * phone_number_id the bot uses to send messages; find it in Meta Business Manager under
 * WhatsApp Accounts, or via GET /{phone_number_id}?fields=whatsapp_business_account).
 * A template submitted here lands in Meta's review queue (usually minutes to ~1 day) —
 * this script only submits, it doesn't wait for approval. Re-running with the same name
 * after a rejection requires either editing the name or deleting the rejected version in
 * Business Manager first — Meta doesn't allow silently overwriting a template by name.
 */

const fs = require('fs')
const path = require('path')

function loadEnv(file) {
  if (!fs.existsSync(file)) return
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    if (!(key in process.env)) process.env[key] = val
  }
}
loadEnv(path.join(process.cwd(), '.env.local'))
loadEnv(path.join(process.cwd(), '.env'))

const GRAPH_API_VERSION = 'v23.0'
const ACCESS_TOKEN = String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim()
const WABA_ID = String(process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '').trim()

const isLive = process.argv.includes('--live')
const onlyArg = process.argv.find((a) => a.startsWith('--only='))
const only = onlyArg ? onlyArg.split('=')[1] : null

// Every template is UTILITY (transactional/status updates tied to an existing order,
// booking, cart, or account action — not promotional). Meta may recategorize
// buyer_cart_recovery to MARKETING on review since it's a soft re-engagement nudge rather
// than about an already-agreed transaction; if so, accept their recategorization rather
// than fight it, it doesn't change how sendTemplateMessage calls it.
const TEMPLATES = [
  {
    // params: [ref, serviceTitle, formattedAmount] — lib/whatsapp/service-quote.ts's
    // notifyWaBuyerCounterReceived, lib/negotiation-service.ts's applyNegotiationAction
    // (customer-facing branch)
    name: 'buyer_booking_counter_received',
    category: 'UTILITY',
    language: 'en',
    body: 'Your provider responded to your request! Ref {{1}}\n{{2}} — new price {{3}}\n\nReply "accept {{1}}" to pay, "counter {{1}} [amount]" to counter back, or "decline {{1}}" to close it.',
    sample: ['A1B2C3D4', 'Home Cleaning', 'NGN 15,000'],
  },
  {
    // params: [ref, serviceTitle, formattedAmount] — lib/whatsapp/service-quote.ts's
    // notifyProviderCounterReceived, lib/negotiation-service.ts's createNegotiation /
    // applyNegotiationAction (provider-facing branches)
    name: 'provider_booking_counter_received',
    category: 'UTILITY',
    language: 'en',
    body: 'New offer on ref {{1}}! {{2}} — buyer offered {{3}}\n\nReply "counter {{1}} [amount]" to counter back, "accept {{1}}" to accept, or "decline {{1}}" to close it.',
    sample: ['A1B2C3D4', 'Home Cleaning', 'NGN 12,000'],
  },
  {
    // params: [serviceTitle, timingLabel] — app/api/admin/booking-reminder-job/route.ts
    // (both the 24h and day-of blocks)
    name: 'buyer_booking_reminder',
    category: 'UTILITY',
    language: 'en',
    body: 'Reminder: {{1}} is {{2}}. See you soon!',
    sample: ['Home Cleaning', 'tomorrow at 14:00'],
  },
  {
    // params: [customerName, serviceTitle, timingLabel] — same job, provider-facing branch
    name: 'provider_booking_reminder',
    category: 'UTILITY',
    language: 'en',
    body: "Reminder: you have a booking coming up with {{1}} for {{2}}. It's scheduled {{3}} — please make sure you're ready.",
    sample: ['Jane Doe', 'Home Cleaning', 'tomorrow at 14:00'],
  },
  {
    // params: [itemCount, topItemTitle] — app/api/admin/whatsapp-cart-recovery-job/route.ts
    name: 'buyer_cart_recovery',
    category: 'UTILITY',
    language: 'en',
    body: 'You left {{1}} item(s) in your cart, including "{{2}}" — reply "cart" to pick up where you left off.',
    sample: ['3', 'Wireless Earbuds'],
  },
  {
    // params: [productTitle, newStock, threshold] — lib/stock-alerts.ts's maybeSendLowStockAlert
    name: 'vendor_low_stock',
    category: 'UTILITY',
    language: 'en',
    body: 'Low Stock Alert: "{{1}}" has only {{2}} unit(s) left (threshold: {{3}}). Restock soon to keep sales flowing.',
    sample: ['Wireless Earbuds', '2', '3'],
  },
  {
    // params: [rating, reviewerName] — lib/review-notifications.ts's notifyReviewSubmitted
    name: 'vendor_review_received',
    category: 'UTILITY',
    language: 'en',
    body: 'New {{1}}-star review from {{2}}! Check it out on your dashboard.',
    sample: ['5', 'Chidi Okafor'],
  },
]

function buildComponents(template) {
  return [
    {
      type: 'BODY',
      text: template.body,
      example: { body_text: [template.sample] },
    },
  ]
}

async function submitTemplate(template) {
  const payload = {
    name: template.name,
    language: template.language,
    category: template.category,
    components: buildComponents(template),
  }

  if (!isLive) {
    console.log(`\n[dry-run] Would submit "${template.name}":`)
    console.log(JSON.stringify(payload, null, 2))
    return
  }

  const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${WABA_ID}/message_templates`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    console.error(`✗ ${template.name}: FAILED —`, JSON.stringify(data))
    return
  }

  console.log(`✓ ${template.name}: submitted (id ${data.id || '?'}, status ${data.status || 'PENDING'})`)
}

async function main() {
  if (isLive && (!ACCESS_TOKEN || !WABA_ID)) {
    console.error('Missing WHATSAPP_ACCESS_TOKEN and/or WHATSAPP_BUSINESS_ACCOUNT_ID — set both before running with --live.')
    process.exit(1)
  }

  const templates = only ? TEMPLATES.filter((t) => t.name === only) : TEMPLATES
  if (only && templates.length === 0) {
    console.error(`No template named "${only}" — available: ${TEMPLATES.map((t) => t.name).join(', ')}`)
    process.exit(1)
  }

  console.log(isLive ? `Submitting ${templates.length} template(s) to Meta for review...` : `Dry run — ${templates.length} template(s), pass --live to actually submit.`)

  for (const template of templates) {
    await submitTemplate(template)
  }

  if (isLive) {
    console.log('\nDone. Check WhatsApp Business Manager → Account tools → Message templates for review status.')
  }
}

main().catch((error) => {
  console.error('Failed:', error)
  process.exit(1)
})
