# WhatsApp message templates the bot uses

Meta only lets a business message a customer outside the 24-hour window after the
customer's last message if it uses an **approved template**. The bot tries the template
first and falls back to free text (which Meta silently drops outside the window), so
until these are approved the proactive messages only reach buyers who wrote in the last
24 hours.

Create each under **Meta Business Suite → WhatsApp Manager → Message templates**,
category *Utility* unless noted, language *English*. Parameter numbers must match.

Already approved (referenced by existing code): `order_received`, `order_status_update`,
`buyer_order_status_update`, `buyer_order_paid_confirmation`.

## buyer_review_prompt — Utility (created via API 2026-09-18, id 4438111713095491)
Used by: `lib/whatsapp/proactive.ts` (2 days after an order is marked received)

```
How was your {{1}}? Reply with a number from 1 to 5 (5 = loved it). Your rating helps other buyers and the seller. Reply "skip" if you'd rather not.
```
{{1}} = product name

## buyer_back_in_stock — Marketing (created via API 2026-09-18, id 1693983339010379)
Used by: `lib/whatsapp/proactive.ts` (when a product a buyer wanted is back)

```
Good news — {{1}} is back in stock at {{2}}. Reply "add" to put it in your cart, or "details" to hear more.
```
{{1}} = product name, {{2}} = price (e.g. NGN 15,000)
Footer: "Reply STOP to opt out of stock alerts" — the bot honours STOP/START
(WhatsAppBuyer.marketingOptOut), which also silences cart reminders.

## buyer_cart_recovery — Marketing (already approved)
Used by: `app/api/admin/whatsapp-cart-recovery-job`. Respects STOP.

Templates can be listed/created with the system-user token:
`GET/POST https://graph.facebook.com/v23.0/{WABA_ID}/message_templates`.
