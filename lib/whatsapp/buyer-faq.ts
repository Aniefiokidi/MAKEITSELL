// Canned answers for the questions a human shop assistant fields constantly and that are
// never a product name: delivery, payment, returns, "talk to someone", acknowledgements,
// and card actions sent without replying to a card. Pure text-in/text-out so it is cheap
// to test; the router (lib/whatsapp/buyer.ts) checks it before falling through to search.
import { RETURN_DAYS } from '@/lib/after-sales-policy'

export type FaqTopic = 'about' | 'how-to-order' | 'discount' | 'ack' | 'contextless' | 'delivery' | 'payment' | 'returns' | 'support'
export type FaqAnswer = { kind: 'text'; topic: FaqTopic; body: string } | { kind: 'categories' }

const SUPPORT_EMAIL = 'support@makeitsell.ng'

function siteUrl(path: string): string {
  const base = String(process.env.NEXT_PUBLIC_APP_URL || 'https://makeitsell.ng').replace(/\/+$/, '')
  return `${base}${path}`
}

const ACK_PATTERN = /^(?:ok(?:ay)?|k|kk|alright|alrighty|fine|cool|sure|noted|got it|no problem|np|nice|great|good|perfect|👍|👌|🙏|yes ?o|okay o|ok o)[\s!.]*$/i
const DELIVERY_PATTERN = /\b(deliver(?:y|ies)?|ship(?:ping)?|dispatch|courier|waybill)\b.*\b(to|how|when|long|fee|cost|price|much|fast|days?|abuja|lagos|state|nationwide|outside|location|area|my)\b|\b(do you|una dey|can you|you dey|how much|what(?:'s| is) the (?:cost|fee|price)|cost|fee)\b.*\b(deliver(?:y|ies)?|shipping|dispatch)\b/i
const PAYMENT_PATTERN = /\b(how|where|can|do)\b.*\b(pay|payment|transfer|card|pos|ussd|paystack)\b|\bpayment (?:method|option)s?\b|\b(pay on delivery|cash on delivery|pod|cod)\b|\bis it safe\b|\bescrow\b/i
const RETURNS_PATTERN = /\b(return|refund|exchange|replace(?:ment)?|warranty|guarantee|policy|fake|wrong item|damaged|not working|faulty)\b/i
const HUMAN_PATTERN = /\b(?:talk|speak|chat)\s+(?:to|with)\s+(?:an?\s+)?(?:human|agent|person|someone|somebody|representative|rep|customer (?:care|service|support))\b|\b(?:customer (?:care|service|support)|human agent|real person|live agent|live chat)\b|\b(?:i want to|how (?:do|can) i|where (?:do|can) i)\s+(?:complain|make a complaint|report (?:a|an|the|this)\b)|\bcomplaints?\b|\byour (?:phone|contact) number\b/i
const CATALOG_PATTERN = /^(?:what (?:do|can) (?:you|i|una) (?:sell|have|get|buy|find)|what(?:'s| is) available|wetin (?:una|you|dey) (?:get|sell|have|dey sell)|wetin dey|show me (?:everything|all|what you have)|what (?:else )?do you (?:have|sell))[\s?!.]*$/i
const DISCOUNT_PATTERN = /\b(discount|last price|best price|reduce|reduction|negotiat(?:e|able)|bargain|cheaper price|lower price|price too high|too expensive|promo|coupon|voucher)\b/i
const HOW_TO_ORDER_PATTERN = /\b(how (?:do|can) i (?:order|buy|purchase|shop|place an order)|how (?:does|do) (?:this|it|ordering|buying) work|how to (?:order|buy|use this)|what (?:do|should) i do)\b/i
const ABOUT_PATTERN = /\b(what is (?:this|makeitsell|make it sell)|who are you|are you a bot|is this a bot|what can you do|what do you do)\b/i
const CONTEXTLESS_ACTION_PATTERN = /^(?:add|buy|yes|this|this one|that one|i want this|i want that|take it|add to cart|\d{1,2})[\s!.]*$/i
const CONTEXTLESS_PRICE_PATTERN = /^(?:how much(?: be| is| for)?(?: this| that| it| this one| dis)?|price|what(?:'s| is) the price|how much be dis)[\s?!.]*$/i

// `hasRecentResults`: product cards are on screen, so "add", "2", "yes", "ok" and "how
// much?" are about those cards (lib/whatsapp/recent-results.ts) — not context-less.
export function answerBuyerFaq(text: string, options: { hasRecentResults?: boolean } = {}): FaqAnswer | null {
  const trimmed = String(text || '').trim()
  if (!trimmed) return null
  const contextless = !options.hasRecentResults

  if (ABOUT_PATTERN.test(trimmed)) {
    return { kind: 'text', topic: 'about', body: 'I\'m the Make It Sell shopping assistant. Tell me what you want to buy and I\'ll find it from our sellers, add it to your cart and check you out with delivery to your door — or tell me a service you need and where you are, and I\'ll send you the closest providers\' contacts and rates.' }
  }
  if (HOW_TO_ORDER_PATTERN.test(trimmed)) {
    return { kind: 'text', topic: 'how-to-order', body: 'Easy: 1) tell me what you want (e.g. "sneakers under ₦20,000"); 2) reply with the number of the card you like to add it to your cart; 3) type "checkout" — I\'ll take your name and address, show delivery options, and send a secure payment link. Your money stays in escrow until you confirm delivery.' }
  }
  if (DISCOUNT_PATTERN.test(trimmed)) {
    return { kind: 'text', topic: 'discount', body: 'Prices are set by each seller and I can\'t negotiate them here — but I can find you something cheaper. Tell me your budget, e.g. "sneakers under ₦10,000", or ask for the "cheapest" of what you want.' }
  }
  if (contextless && ACK_PATTERN.test(trimmed)) {
    return { kind: 'text', topic: 'ack', body: 'Whenever you\'re ready, tell me what you need — a product (e.g. "sneakers under ₦20,000") or a service (e.g. "plumber in Yaba").' }
  }
  if (CATALOG_PATTERN.test(trimmed)) return { kind: 'categories' }
  if (contextless && CONTEXTLESS_ACTION_PATTERN.test(trimmed)) {
    return { kind: 'text', topic: 'contextless', body: 'Which item? Reply directly to the product card you want (long-press it, tap Reply) and say "add" or a quantity. If you haven\'t searched yet, tell me what you\'re looking for.' }
  }
  if (contextless && CONTEXTLESS_PRICE_PATTERN.test(trimmed)) {
    return { kind: 'text', topic: 'contextless', body: 'Which item? Reply directly to its product card and ask, or tell me the product name and I\'ll send the price.' }
  }
  if (DELIVERY_PATTERN.test(trimmed)) {
    return {
      kind: 'text',
      topic: 'delivery',
      body: 'We deliver nationwide by courier. The delivery fee depends on your address and the seller\'s location — you\'ll see the exact options and prices at checkout before you pay, and delivery usually takes 1–5 working days. Tell me what you\'d like to buy to get started.',
    }
  }
  if (PAYMENT_PATTERN.test(trimmed)) {
    return {
      kind: 'text',
      topic: 'payment',
      body: 'Payment is online and secure: after checkout I send you a payment link (card, bank transfer or USSD). Your money is held in escrow and only released to the seller after you confirm delivery, so you\'re protected. We don\'t do pay-on-delivery.',
    }
  }
  if (RETURNS_PATTERN.test(trimmed)) {
    return {
      kind: 'text',
      topic: 'returns',
      body: `If something arrives wrong, damaged or not as described, report it within ${RETURN_DAYS} days of delivery and the seller\'s payout is paused while we sort it out — refunds follow inspection. Change-of-mind returns are accepted where the seller allows them (you cover return delivery). Full policy: ${siteUrl('/returns')}`,
    }
  }
  if (HUMAN_PATTERN.test(trimmed)) {
    return {
      kind: 'text',
      topic: 'support',
      body: `Our support team can help: email ${SUPPORT_EMAIL} or use the help page at ${siteUrl('/contact')}. If it\'s about an order, include the order reference (type "my orders" to see it).`,
    }
  }
  return null
}
