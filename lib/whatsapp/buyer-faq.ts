// Canned answers for the questions a human shop assistant fields constantly and that are
// never a product name: delivery, payment, returns, "talk to someone", acknowledgements,
// and card actions sent without replying to a card. Pure text-in/text-out so it is cheap
// to test; the router (lib/whatsapp/buyer.ts) checks it before falling through to search.
import { RETURN_DAYS } from '@/lib/after-sales-policy'

export type FaqAnswer = { kind: 'text'; body: string } | { kind: 'categories' }

const SUPPORT_EMAIL = 'support@makeitsell.ng'

function siteUrl(path: string): string {
  const base = String(process.env.NEXT_PUBLIC_APP_URL || 'https://makeitsell.ng').replace(/\/+$/, '')
  return `${base}${path}`
}

const ACK_PATTERN = /^(?:ok(?:ay)?|k|kk|alright|alrighty|fine|cool|sure|noted|got it|no problem|np|nice|great|good|perfect|👍|👌|🙏|yes ?o|okay o|ok o)[\s!.]*$/i
const DELIVERY_PATTERN = /\b(deliver(?:y|ies)?|ship(?:ping)?|dispatch|courier|waybill)\b.*\b(to|how|when|long|fee|cost|price|much|fast|days?|abuja|lagos|state|nationwide|outside|location|area|my)\b|\b(do you|una dey|can you|you dey)\b.*\bdeliver/i
const PAYMENT_PATTERN = /\b(how|where|can|do)\b.*\b(pay|payment|transfer|card|pos|ussd|paystack)\b|\bpayment (?:method|option)s?\b|\b(pay on delivery|cash on delivery|pod|cod)\b|\bis it safe\b|\bescrow\b/i
const RETURNS_PATTERN = /\b(return|refund|exchange|replace(?:ment)?|warranty|guarantee|policy|fake|wrong item|damaged|not working|faulty)\b/i
const HUMAN_PATTERN = /\b(?:talk|speak|chat)\s+(?:to|with)\s+(?:an?\s+)?(?:human|agent|person|someone|somebody|representative|rep|customer (?:care|service|support))\b|\b(?:customer (?:care|service|support)|human agent|real person|live agent|live chat)\b|\b(?:i want to|how (?:do|can) i|where (?:do|can) i)\s+(?:complain|make a complaint|report (?:a|an|the|this)\b)|\bcomplaints?\b|\byour (?:phone|contact) number\b/i
const CATALOG_PATTERN = /^(?:what (?:do|can) (?:you|i|una) (?:sell|have|get|buy|find)|what(?:'s| is) available|wetin (?:una|you|dey) (?:get|sell|have|dey sell)|wetin dey|show me (?:everything|all|what you have)|what (?:else )?do you (?:have|sell))[\s?!.]*$/i
const CONTEXTLESS_ACTION_PATTERN = /^(?:add|buy|yes|this|this one|that one|i want this|i want that|take it|add to cart|\d{1,2})[\s!.]*$/i
const CONTEXTLESS_PRICE_PATTERN = /^(?:how much(?: be| is| for)?(?: this| that| it| this one| dis)?|price|what(?:'s| is) the price|how much be dis)[\s?!.]*$/i

export function answerBuyerFaq(text: string): FaqAnswer | null {
  const trimmed = String(text || '').trim()
  if (!trimmed) return null

  if (ACK_PATTERN.test(trimmed)) {
    return { kind: 'text', body: 'Whenever you\'re ready, tell me what you need — a product (e.g. "sneakers under ₦20,000") or a service (e.g. "plumber in Yaba").' }
  }
  if (CATALOG_PATTERN.test(trimmed)) return { kind: 'categories' }
  if (CONTEXTLESS_ACTION_PATTERN.test(trimmed)) {
    return { kind: 'text', body: 'Which item? Reply directly to the product card you want (long-press it, tap Reply) and say "add" or a quantity. If you haven\'t searched yet, tell me what you\'re looking for.' }
  }
  if (CONTEXTLESS_PRICE_PATTERN.test(trimmed)) {
    return { kind: 'text', body: 'Which item? Reply directly to its product card and ask, or tell me the product name and I\'ll send the price.' }
  }
  if (DELIVERY_PATTERN.test(trimmed)) {
    return {
      kind: 'text',
      body: 'We deliver nationwide by courier. The delivery fee depends on your address and the seller\'s location — you\'ll see the exact options and prices at checkout before you pay, and delivery usually takes 1–5 working days. Tell me what you\'d like to buy to get started.',
    }
  }
  if (PAYMENT_PATTERN.test(trimmed)) {
    return {
      kind: 'text',
      body: 'Payment is online and secure: after checkout I send you a payment link (card, bank transfer or USSD). Your money is held in escrow and only released to the seller after you confirm delivery, so you\'re protected. We don\'t do pay-on-delivery.',
    }
  }
  if (RETURNS_PATTERN.test(trimmed)) {
    return {
      kind: 'text',
      body: `If something arrives wrong, damaged or not as described, report it within ${RETURN_DAYS} days of delivery and the seller\'s payout is paused while we sort it out — refunds follow inspection. Change-of-mind returns are accepted where the seller allows them (you cover return delivery). Full policy: ${siteUrl('/returns')}`,
    }
  }
  if (HUMAN_PATTERN.test(trimmed)) {
    return {
      kind: 'text',
      body: `Our support team can help: email ${SUPPORT_EMAIL} or use the help page at ${siteUrl('/contact')}. If it\'s about an order, include the order reference (type "my orders" to see it).`,
    }
  }
  return null
}
