// Deterministic FAQ-lookup support bot. No LLM call, no external API, no quota risk —
// the bot matches the customer's question (English or Pidgin) against a fixed set of
// researched, verified answers about how MakeItSell actually works.

export interface FaqResponse {
  canResolve: boolean
  response: string
  suggestedActions: string[]
  escalationReason?: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
}

interface FaqEntry {
  id: string
  keywords: string[] // normalized (English-ish) trigger words/phrases, matched as whole words
  answer: { en: string; pcm: string }
  actions: { en: string[]; pcm: string[] }
}

// Translate common Pidgin words/phrases to English equivalents so a single keyword list
// can match both languages. Pattern lifted from the project's existing Pidgin handling.
export function normalize(text: string): string {
  return text
    .toLowerCase()
    // Common typos/SMS-shorthand corrected FIRST — the Pidgin phrase rules below check
    // for exact words like "delivery" / "order", so a misspelling has to be fixed
    // before those rules run, or they silently fail to match.
    .replace(/\boder\b|\bordr\b/g, 'order')
    .replace(/\bdelivrey\b|\bdeleviry\b|\bdelivary\b|\bdelvery\b/g, 'delivery')
    .replace(/\bpayamnt\b|\bpaymant\b|\bpayemnt\b|\bpaymnt\b/g, 'payment')
    .replace(/\brefnd\b|\brefundd\b/g, 'refund')
    .replace(/\bcancle\b|\bcancell\b/g, 'cancel')
    .replace(/\bwithdrawl\b|\bwitdrawal\b/g, 'withdrawal')
    .replace(/\brecieve\b/g, 'receive')
    .replace(/\baccaunt\b|\baccout\b/g, 'account')
    .replace(/\bpasswrod\b|\bpasswod\b/g, 'password')
    .replace(/\bvender\b/g, 'vendor')
    .replace(/\bapointment\b|\bappointmnt\b/g, 'appointment')
    .replace(/\bbookin\b/g, 'booking')
    .replace(/\breferal\b/g, 'referral')
    .replace(/\bwetin\b/g, 'what')
    .replace(/\babeg\b/g, 'please')
    .replace(/\bna\b/g, 'is')
    .replace(/\babi\b/g, 'or')
    .replace(/\bdem\b/g, 'they')
    .replace(/\bdey\b|\bde\b/g, 'are')
    .replace(/\bno be\b/g, 'not')
    .replace(/\bwey\b/g, 'where')
    .replace(/\bsabi\b/g, 'know')
    .replace(/\bfit\b/g, 'can')
    .replace(/\bwan\b/g, 'want')
    .replace(/\buna\b/g, 'you')
    .replace(/\bwahala\b/g, 'problem')
    .replace(/\bsha\b|\bshey\b|\bnau\b|\bnaw\b/g, '') // discourse fillers/particles — carry no lexical content for matching
    .replace(/\bmake i\b/g, 'let me')
    .replace(/\be go\b/g, 'will it')
    .replace(/\be reach\b|\be don reach\b|\be reach me\b/g, 'has it arrived')
    .replace(/\be never reach\b|\b(order|delivery|package|thing)\s+never\s+(reach|come)\b/g, 'order not arrived')
    .replace(/\bmoney never enter\b|\bmoney no enter\b|\bno money enter\b/g, 'payment not received')
    .replace(/\bdem deduct my money\b|\bmy money go\b|\bchop my money\b/g, 'i was charged')
    .replace(/\bwithdraw[a]?l never land\b|\bwithdrawal never come\b|\bnever land\b/g, 'withdrawal not arrived')
    .replace(/\bdem never send\b|\bnever send\b/g, 'not sent')
    .replace(/\bwhere my thing\b|\bwia my order\b/g, 'where is my order')
    .replace(/\bi no sabi\b/g, "i don't know")
    .replace(/\bhow i go\b|\bhow e go\b|\bhow e take\b|\bhow i fit\b|\bhow you go\b/g, 'how do i')
    .replace(/\bi wan\b/g, 'i want')
    .replace(/\bwan buy\b|\bwant buy\b/g, 'want to buy')
    .replace(/\bwan order\b|\bwant order\b/g, 'want to order')
    .replace(/\bwan sell\b|\bwant sell\b/g, 'want to sell')
    .replace(/\bpls\b/g, 'please')
    .replace(/\bu\b/g, 'you')
}

// Checked against the RAW (pre-normalize) query — normalize() already translates these
// away, so language detection has to happen before translation.
const PIDGIN_MARKERS = /\b(wetin|abeg|dey|de|wan|sabi|na|dem|wey|abi|una|wahala|howfar|how far|how body|e dey|e no dey|no gree|don do|never enter|never land|never reach|never come|chop|kampe|omo|shey|sha)\b/i

function isPidgin(rawQuery: string): boolean {
  return PIDGIN_MARKERS.test(rawQuery)
}

export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9']+/g) || []
}

// Light suffix stemming so word-form variants match each other ("booking"/"book",
// "services"/"service", "orders"/"order") without needing every keyword phrase to
// enumerate every conjugation. Tuned to this app's vocabulary rather than a general
// English stemmer — good enough for consistent matching, not linguistically perfect.
function stem(word: string): string {
  let w = word
  if (w.length > 5 && w.endsWith('ies')) return `${w.slice(0, -3)}y` // categories -> category
  if (w.length > 4 && (w.endsWith('ing') || w.endsWith('ed'))) {
    const suffixLen = w.endsWith('ing') ? 3 : 2
    let root = w.slice(0, -suffixLen)
    // doubled consonant: shipping -> ship, cancelled -> cancel
    if (root.length > 2 && root[root.length - 1] === root[root.length - 2] && !/[aeiou]/.test(root[root.length - 1])) {
      root = root.slice(0, -1)
    }
    return root
  }
  if (w.length > 4 && /(?:s|x|ch|sh)es$/.test(w)) return w.slice(0, -2) // boxes -> box, dishes -> dish
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) return w.slice(0, -1) // plural
  return w
}

// A keyword phrase matches if its (stemmed) words appear in the query IN ORDER, with
// any other words allowed in between ("forgot password" matches "forgot my password";
// "card declined" matches "card was declined"; "book service" matches "book services"
// or "booking a service") — but every word of the phrase must actually be present, so
// short generic phrases like "how are you" can't collapse down to a single common word
// (e.g. "how") and false-match unrelated queries.
function matchesOrderedPhrase(queryTokens: string[], phrase: string): boolean {
  const phraseTokens = tokenize(phrase).map(stem)
  if (phraseTokens.length === 0) return false
  const stemmedQuery = queryTokens.map(stem)
  let cursor = 0
  for (const pt of phraseTokens) {
    const idx = stemmedQuery.indexOf(pt, cursor)
    if (idx === -1) return false
    cursor = idx + 1
  }
  return true
}

function matchesEntry(queryTokens: string[], entry: FaqEntry): number {
  let score = 0
  for (const kw of entry.keywords) {
    // Weight by word count so a specific multi-word phrase ("withdrawal not arrived")
    // reliably outscores a broader single-word match ("withdrawal") regardless of
    // which entry happens to be defined first in the FAQ array.
    if (matchesOrderedPhrase(queryTokens, kw)) score += tokenize(kw).length
  }
  return score
}

const FAQ: FaqEntry[] = [
  {
    id: 'greeting',
    keywords: ['hi', 'hello', 'hey', 'howfar', 'how far', 'how body', 'good morning', 'good afternoon', 'good evening', 'how are you', "what's up", 'whats up'],
    answer: {
      en: "Hey! How can I help you today? — orders, payments, wallet, bookings, or anything else on Make It Sell.",
      pcm: "I dey! Wetin I fit do for you today? — order, payment, wallet, booking, anything at all.",
    },
    actions: {
      en: ['Track my order', 'Payment issue', 'Wallet / withdrawal help', 'Book a service'],
      pcm: ['Track my order', 'Payment issue', 'Wallet / withdrawal help', 'Book a service'],
    },
  },
  {
    id: 'live-tracking',
    keywords: ['rider', 'track rider', 'live tracking', 'live track', 'where is my rider', 'rider location', 'track my delivery', 'track delivery live', 'is rider close'],
    answer: {
      en: "If a rider has been assigned to your order, you'll see a **\"Track Your Delivery Live\"** button on the order in My Orders — tap it to see the rider's live location on a map and an estimated arrival time. You'll also get a notification when they're outside.",
      pcm: "If dem don assign rider for your order, you go see \"Track Your Delivery Live\" button for your order for My Orders — click am make you see the rider live for map plus how long e go take. We go send you notification when the rider don reach.",
    },
    actions: {
      en: ['Check My Orders', "I don't see a tracking link", 'My order has no rider yet'],
      pcm: ['Check My Orders', 'I no see tracking link', 'My order never get rider'],
    },
  },
  {
    id: 'order-status',
    keywords: ['order status', 'track order', 'where is my order', 'my order', 'order not arrived', 'order not received', 'has it arrived', 'delivery status'],
    answer: {
      en: "You can track any order from **My Orders** in your account — it shows the current stage (Confirmed → Shipped → Out for Delivery → Delivered) plus a live tracking link if a rider has been assigned. Delivery within Lagos usually takes 1–3 business days; other states take 3–7 business days.",
      pcm: "Go **My Orders** for your account make you see the stage of your order (Confirmed → Shipped → Out for Delivery → Delivered), plus live tracking link if dem don assign rider. Delivery for Lagos dey take 1–3 working days; outside Lagos e fit take 3–7 days.",
    },
    actions: {
      en: ['Check My Orders', 'Track my delivery live', "It's taking too long"],
      pcm: ['Check My Orders', 'Track my delivery live', 'E don take too long'],
    },
  },
  {
    id: 'delivery-delay',
    keywords: ['delivery late', 'delivery delay', 'taking too long', 'order late', 'order delay', "hasn't arrived"],
    answer: {
      en: "Sorry about the delay. Delays are usually vendor processing time or courier volume. Check My Orders for the current stage first — if it's still \"Processing\" after 2 business days, or \"Shipped\" with no movement, contact the vendor directly through their store page. If they don't respond within 48 hours, you can raise a dispute with us.",
      pcm: "Sorry the delay dey pain. E fit be say vendor still dey pack am, or courier get plenty work. Check My Orders first make you see the stage — if e still dey \"Processing\" pass 2 working days, or e don \"Ship\" but nothing dey move, message the vendor for their store page. If dem no reply within 48 hours, you fit raise dispute make we help you.",
    },
    actions: {
      en: ['Check My Orders', 'Contact the vendor', 'Raise a dispute'],
      pcm: ['Check My Orders', 'Message the vendor', 'Raise dispute'],
    },
  },
  {
    id: 'returns-refund',
    keywords: ['return', 'refund', 'exchange', 'send back', 'defective', 'damaged', 'wrong item'],
    answer: {
      en: "You have a **7-day window from delivery date** to request a return or refund. Contact the vendor first through their store page — explain the issue and what you want (refund/replacement). If they don't respond within 48 hours, or you can't reach a resolution, raise a dispute with Make It Sell support and we'll step in. Approved refunds go back via Paystack to your original payment method, usually within 3–7 business days.",
      pcm: "You get **7 days from when your order land** to return am or ask for refund. First message the vendor for their store page, explain wetin happen and wetin you want. If dem no reply within 48 hours, or una no fit agree, raise dispute make we help you. If we approve refund, e go return your money through Paystack — normally within 3–7 working days.",
    },
    actions: {
      en: ['Contact the vendor', 'Raise a dispute', "Check the vendor's return policy"],
      pcm: ['Message the vendor', 'Raise dispute', 'Check return policy'],
    },
  },
  {
    id: 'cancel-order',
    keywords: ['cancel order', 'cancel my order', 'cancel purchase'],
    answer: {
      en: "You can cancel an order from **My Orders** as long as it hasn't been marked \"Out for Delivery\" yet — open the order and tap Cancel. If the payment was in escrow, the amount is refunded to your wallet. Once it's out for delivery, cancellation isn't available — you'd need to refuse delivery or request a return afterward.",
      pcm: "You fit cancel order for **My Orders** as long as e never reach \"Out for Delivery\" — open the order, click Cancel. If we don hold your money for escrow, e go return enter your wallet. Once e don dey \"Out for Delivery\" you no fit cancel again — you go need refuse the delivery or return am after.",
    },
    actions: {
      en: ['Go to My Orders', "Why can't I cancel this order?"],
      pcm: ['Go My Orders', 'Why I no fit cancel this order?'],
    },
  },
  {
    id: 'payment-methods',
    keywords: ['payment method', 'how to pay', 'pay with', 'accepted cards', 'paystack', 'bank transfer', 'cash on delivery', 'cod'],
    answer: {
      en: "Payments go through **Paystack** only — Verve, Mastercard, or Visa debit/credit cards, plus direct bank transfer. There's no cash on delivery. You can also pay from your Make It Sell wallet balance if you've topped it up.",
      pcm: "We dey use **Paystack** only — Verve, Mastercard, or Visa card, plus bank transfer. No cash on delivery. You fit also pay from your wallet balance if you don top am up before.",
    },
    actions: {
      en: ['My card was declined', 'I was charged but order not showing', 'Top up my wallet'],
      pcm: ['My card no gree work', 'Dem charge me but order no show', 'Top up my wallet'],
    },
  },
  {
    id: 'payment-charged-no-order',
    keywords: ['charged but', 'debited but', 'money go but', 'payment not received', 'i was charged', 'money left my account'],
    answer: {
      en: "This is a common Paystack timing issue — nothing is lost. First check **My Orders**, the order may already be there even without a confirmation email; also check your email spam folder. If the order truly isn't there, the money is held by Paystack and auto-returns to your card/wallet within 1–5 business days. If it's been longer than 5 business days, contact support with your bank debit alert (amount, date, last 4 digits of card).",
      pcm: "This na common Paystack wahala — nothing dey lost. First check **My Orders**, order fit already dey there even without confirmation mail; check your email spam folder too. If order no dey there true-true, Paystack dey hold the money and e go return enter your card/wallet within 1–5 working days. If e don pass 5 working days, contact support with your bank alert details (amount, date, last 4 digits of card).",
    },
    actions: {
      en: ['Check My Orders', "It's been more than 5 days", 'Talk to a human agent'],
      pcm: ['Check My Orders', 'E don pass 5 days', 'Talk to human agent'],
    },
  },
  {
    id: 'card-declined',
    keywords: ['card declined', 'card not working', 'payment failed', 'card blocked', 'card fail'],
    answer: {
      en: "Card declines are usually: insufficient funds, the card not enabled for online transactions (call your bank to activate), the OTP session timing out, or a bank-side international/online block. Try bank transfer instead — it's more reliable — or a different card.",
      pcm: "Card wey no gree work na usually: no money reach, card no dey enabled for online (call your bank make dem activate am), OTP time don pass, or bank block online payment. Try bank transfer instead — e dey more reliable — or try another card.",
    },
    actions: {
      en: ['Try bank transfer instead', 'Help me activate my card for online payments', 'Try a different card'],
      pcm: ['Try bank transfer instead', 'Help me activate my card', 'Try another card'],
    },
  },
  {
    id: 'wallet-general',
    keywords: ['wallet balance', 'my wallet', 'top up wallet', 'fund wallet', 'wallet wrong'],
    answer: {
      en: "Your wallet holds money from sales (vendors), referral/prize bonuses, and any top-ups you've made. View it at **/wallet** — full transaction history is there too. To top up, tap \"Top Up\" and pay via Paystack; you can then use the balance at checkout.",
      pcm: "Your wallet get money from sales (for vendors), referral/prize bonus, and any top-up wey you don do. Go **/wallet** make you see am — full transaction history dey there too. To top up, click \"Top Up\", pay through Paystack; you fit use the balance when you dey checkout.",
    },
    actions: {
      en: ['How to withdraw my earnings', 'Top up my wallet', 'My balance looks wrong'],
      pcm: ['How to withdraw my earnings', 'Top up my wallet', 'My balance no correct'],
    },
  },
  {
    id: 'withdrawal',
    keywords: ['withdraw', 'withdrawal', 'cash out', 'my earnings', 'payout'],
    answer: {
      en: "Go to **/wallet**, tap Withdraw, enter your Nigerian bank account details, and submit. Withdrawals are approved within 1 business day, then bank transfer takes 1–3 business days depending on your bank. Note: a **5% fee applies only to earnings from sales** — money you've topped up yourself or won as a prize/referral bonus withdraws with no fee.",
      pcm: "Go **/wallet**, click Withdraw, enter your Nigerian bank details, submit am. E go approve within 1 working day, then bank transfer go take 1–3 working days depending on your bank. Note: **5% fee dey apply only for money wey you make from sales** — money wey you top up yourself or win as prize/referral no get fee.",
    },
    actions: {
      en: ['My withdrawal is delayed', 'Why was I charged a fee?', 'Check withdrawal status'],
      pcm: ['My withdrawal never land', 'Why dem charge me fee?', 'Check withdrawal status'],
    },
  },
  {
    id: 'withdrawal-delayed',
    keywords: ['withdrawal delayed', 'withdrawal not arrived', 'withdrawal not received', 'withdrawal pending', 'withdrawal still', 'money never land'],
    answer: {
      en: "Check the withdrawal status in **/wallet** — if it says \"Completed\", your bank may just need a few more hours. If it's still \"Pending\" after 2 business days, that's unusual — common causes are weekends/public holidays, incorrect bank details, or a slower bank. If it's past 3 business days with no movement, contact support with the amount, date, and bank name and we'll chase it.",
      pcm: "Check the withdrawal status for **/wallet** — if e show \"Completed\", your bank fit just need small more hours. If e still dey \"Pending\" pass 2 working days, that one no normal — e fit be weekend/holiday, wrong bank details, or your bank dey slow small. If e don pass 3 working days with nothing, contact support with the amount, date, and bank name make we trace am.",
    },
    actions: {
      en: ['Check withdrawal status in /wallet', 'Verify my bank details', 'Contact support with details'],
      pcm: ['Check withdrawal status for /wallet', 'Verify my bank details', 'Contact support'],
    },
  },
  {
    id: 'become-vendor',
    keywords: ['become seller', 'become vendor', 'start selling', 'sign up vendor', 'sell on', 'open a store', 'vendor account', 'want to sell', 'want sell', 'vendor'],
    answer: {
      en: "Tap **\"Become a Seller\"** in the menu, fill in your business details (or personal info if starting solo), and submit. Approval typically takes 1–3 business days. Once approved you get a vendor dashboard to list products/services, manage orders, and track earnings — commission on sales is disclosed during signup.",
      pcm: "Click **\"Become a Seller\"** for menu, fill your business details (or your personal info if na just you), submit am. E go take 1–3 working days for approval. Once dem approve you, you go get vendor dashboard to list your product/service, manage orders, track your earnings — commission on sales dem go show you during signup.",
    },
    actions: {
      en: ["Go to 'Become a Seller'", 'How long does approval take?', 'What is the commission?'],
      pcm: ["Go 'Become a Seller'", 'How long approval go take?', 'Wetin be the commission?'],
    },
  },
  {
    id: 'services-booking',
    keywords: ['book service', 'find service', 'where book service', 'how to book', 'service booking', 'booking fee', 'appointment', 'book appointment'],
    answer: {
      en: "Go to **/services**, pick a provider, choose a package (Basic/Standard/Premium) and any add-ons, then tap \"Book Appointment\" and pick a date/time. A flat **₦500 booking fee** is charged to confirm the slot (this is a platform fee, separate from the service price itself). All your bookings appear under **/appointments**.",
      pcm: "Go **/services**, pick provider wey you want, choose package (Basic/Standard/Premium) plus any add-on, click \"Book Appointment\", pick date/time. Dem go charge flat **₦500 booking fee** to confirm the slot (na platform fee, e no be the service price). All your bookings dey show for **/appointments**.",
    },
    actions: {
      en: ['Browse services', 'Negotiate a service price', 'View my appointments'],
      pcm: ['Browse services', 'Negotiate service price', 'View my appointments'],
    },
  },
  {
    id: 'service-cancel',
    keywords: ['cancel booking', 'cancel appointment', 'cancel service', 'cancel my booking', 'cancel my appointment', 'cancel this booking', 'cancel this appointment'],
    answer: {
      en: "You can cancel a booking from **/appointments**. Note there's a **₦5,000 cancellation fee** — this covers the vendor's reserved time slot. If the vendor cancels on you instead, no fee applies to you.",
      pcm: "You fit cancel booking from **/appointments**. Note say **₦5,000 cancellation fee** dey apply — na so vendor go get something for the time slot wey dem don hold for you. If na vendor cancel, no fee go apply for you.",
    },
    actions: {
      en: ['Go to my appointments', 'Why is there a cancellation fee?'],
      pcm: ['Go my appointments', 'Why cancellation fee dey?'],
    },
  },
  {
    id: 'price-negotiation',
    keywords: ['negotiate price', 'negotiate', 'lower price', 'bargain', 'offer price'],
    answer: {
      en: "On any service page, tap **\"Negotiate Price\"**, enter your offer and a short message. The vendor can accept, reject, or counter-offer. Once you both agree, you book at that agreed price. Not every vendor negotiates — it's their choice.",
      pcm: "For any service page, click **\"Negotiate Price\"**, enter the price wey you wan offer plus short message. Vendor fit accept, reject, or counter. Once una agree, you go book at that price. No be every vendor go gree negotiate — na their choice.",
    },
    actions: {
      en: ['Browse services to negotiate', 'Vendor has not responded to my offer'],
      pcm: ['Browse services to negotiate', 'Vendor never reply my offer'],
    },
  },
  {
    id: 'bidding',
    keywords: ['bid', 'bidding', 'auction', 'place a bid', 'won auction', 'outbid'],
    answer: {
      en: "Go to **/bidding** to see live auctions. Enter a bid higher than the current one — if you're highest when the auction ends, you win and pay to receive the item. If someone outbids you, you lose nothing and can bid again or move on.",
      pcm: "Go **/bidding** make you see live auctions. Enter bid wey pass the current one — if your bid dey highest when auction end, you win am and you go pay make dem send the item. If person outbid you, you no lose anything — you fit bid again or leave am.",
    },
    actions: {
      en: ['Browse active auctions', 'How do I pay after winning?', 'My won item has not arrived'],
      pcm: ['Browse active auctions', 'How I go pay after I win?', 'My winning item never reach'],
    },
  },
  {
    id: 'food',
    keywords: ['order food', 'food delivery', 'hungry', 'restaurant', 'food vendor'],
    answer: {
      en: "Go to **/food**, browse vendors, add items to cart, and checkout via Paystack same as any order. Track it in **My Orders** the same way as a product order.",
      pcm: "Go **/food**, browse the vendors, add wetin you want for cart, checkout with Paystack same as normal order. You go track am for **My Orders** same way you go track normal order.",
    },
    actions: {
      en: ['Browse the Food section', 'Check my food order status'],
      pcm: ['Browse Food section', 'Check my food order'],
    },
  },
  {
    id: 'referral',
    keywords: ['referral', 'refer a friend', 'referral code', 'invite friend', 'referral bonus'],
    answer: {
      en: "Every account has a personal referral code — find your card on your dashboard/profile to copy and share it. You earn a flat **₦500 bonus** the first time someone you referred makes their first sale (as a vendor) or first purchase (as a buyer). It's credited straight to your wallet as a prize, no fee on withdrawing it.",
      pcm: "Every account get their own referral code — find your card for dashboard/profile make you copy am go share. You go earn flat **₦500 bonus** the first time person wey you refer make their first sale (if na vendor) or first purchase (if na buyer). E go enter your wallet as prize, no fee if you wan withdraw am.",
    },
    actions: {
      en: ['Where do I find my referral code?', 'My referral bonus has not arrived'],
      pcm: ['Where I go find my referral code?', 'My referral bonus never enter'],
    },
  },
  {
    id: 'login-account',
    keywords: ['login issue', 'cant log in', "can't log in", 'forgot password', 'reset password', 'account locked', 'sign in'],
    answer: {
      en: "Click **\"Forgot Password\"** on the login page and enter your email — check spam folder for the reset link. If you're sure your details are correct but it still fails, try clearing your browser cache or an incognito window; those fix most login glitches.",
      pcm: "Click **\"Forgot Password\"** for the login page, enter your email — check spam folder for the reset link. If you sure say your details correct but e still no gree work, try clear your browser cache or open incognito window; e dey fix most login wahala.",
    },
    actions: {
      en: ["Try 'Forgot Password'", 'Check spam folder', 'Still not working'],
      pcm: ["Try 'Forgot Password'", 'Check spam folder', 'E still no gree work'],
    },
  },
  {
    id: 'contact-vendor',
    keywords: ['contact vendor', 'contact seller', 'message vendor', 'vendor not responding', 'seller not replying'],
    answer: {
      en: "Go to the vendor's store page and use \"Contact Seller\" — include your order number and be specific about the issue. Give them 24–48 hours; most respond quickly since it affects their reputation. If they don't respond in that window, escalate to Make It Sell support.",
      pcm: "Go the vendor store page, click \"Contact Seller\" — put your order number and explain the issue well. Give dem 24–48 hours; most of dem dey reply fast because e dey affect their name. If dem no reply for that time, escalate am to Make It Sell support.",
    },
    actions: {
      en: ['Go to the store page', 'Vendor has not replied in 48 hours'],
      pcm: ['Go store page', 'Vendor never reply pass 48 hours'],
    },
  },
]

// A trigger word that's a real signal but not enough on its own to pick one FAQ entry
// over another ("cancel" alone could mean a product order or a service booking — each
// has a different fee/process). Instead of guessing or dumping the whole menu, ask a
// short follow-up whose answers are phrased so clicking one resolves unambiguously
// against the normal FAQ keywords above.
interface AmbiguousTrigger {
  keyword: string
  question: { en: string; pcm: string }
  options: { en: string[]; pcm: string[] }
}

const AMBIGUOUS_TRIGGERS: AmbiguousTrigger[] = [
  {
    keyword: 'cancel',
    question: {
      en: "Sure — do you want to cancel a **product order**, or a **service booking/appointment**? The process (and any fee) is different for each.",
      pcm: "No wahala — you wan cancel **product order**, or **service booking/appointment**? The process (and fee) no be the same for the two.",
    },
    options: {
      en: ['Cancel a product order', 'Cancel a service booking'],
      pcm: ['Cancel a product order', 'Cancel a service booking'],
    },
  },
]

// Broad "where/how do I buy X" intent — kept out of the main FAQ array deliberately.
// Its keywords are generic enough that they'd otherwise outscore and steal traffic from
// more specific entries (e.g. "I want to order food" should hit the food entry, not
// this one) — so it's only consulted as a fallback, after every specific entry above
// has already had a chance to match.
const PRODUCT_DISCOVERY: FaqEntry = {
  id: 'product-discovery',
  keywords: ['want to buy', 'want to order', 'want buy', 'want order', 'where can i buy', 'where can i find', 'where do i find', 'looking for', 'how to buy', 'how to order', 'how to purchase', 'how do i buy', 'how do i order', 'how do i shop', 'find product'],
  answer: {
    en: "You can browse everything at **/products**, or by category at **/categories** — use the search bar at the top to look for something specific (just type the product name, e.g. \"cosmetics\" or \"phone\"). Once you find what you want, add it to cart and checkout via Paystack — same flow for any vendor.",
    pcm: "You fit browse everything for **/products**, or by category for **/categories** — use the search bar for top make you find wetin you want (just type the product name, e.g. \"cosmetics\" or \"phone\"). Once you see wetin you want, add am to cart, checkout with Paystack — same process for any vendor.",
  },
  actions: {
    en: ['Browse products', 'Browse categories', 'Search for something specific'],
    pcm: ['Browse products', 'Browse categories', 'Search for something specific'],
  },
}

const DEFAULT_ANSWER: Record<'en' | 'pcm', string> = {
  en: "I don't have a specific answer for that one yet, but here's what I can help with:\n\n• Orders & delivery — tracking, cancellations, returns/refunds\n• Services & bookings — booking, price negotiation, cancellations\n• Wallet & payments — top-ups, withdrawals, Paystack issues\n• Becoming a seller, bidding, food orders, referrals\n\nIf your question isn't covered, tap below to reach a human agent.",
  pcm: "I no get direct answer for that one yet, but see wetin I fit help you with:\n\n• Order & delivery — tracking, cancel, return/refund\n• Service & booking — booking, negotiate price, cancel\n• Wallet & payment — top-up, withdrawal, Paystack wahala\n• Becoming seller, bidding, food order, referral\n\nIf your question no dey there, click below make we connect you to human agent.",
}

const DEFAULT_ACTIONS: Record<'en' | 'pcm', string[]> = {
  en: ['Track my order', 'Book a service', 'Wallet / withdrawal help', 'Talk to a human agent'],
  pcm: ['Track my order', 'Book a service', 'Wallet / withdrawal help', 'Talk to human agent'],
}

export interface FaqMatch {
  response: FaqResponse
  matchedEntryId: string | null // null = fell through to disambiguation/fallback — a real FAQ gap
  normalizedQuery: string
  lang: 'en' | 'pcm'
  entry: FaqEntry | null // the matched entry, if any — used for personalization lookups
}

export function matchFaq(query: string, context?: { userName?: string }): FaqMatch {
  const raw = String(query || '')
  const pidgin = isPidgin(raw)
  const lang: 'en' | 'pcm' = pidgin ? 'pcm' : 'en'
  const normalizedQuery = normalize(raw)
  const queryTokens = tokenize(normalizedQuery)

  let best: FaqEntry | null = null
  let bestScore = 0
  for (const entry of FAQ) {
    const score = matchesEntry(queryTokens, entry)
    if (score > bestScore) {
      best = entry
      bestScore = score
    }
  }

  const greeting = context?.userName ? `${context.userName}, ` : ''

  // Nothing specific matched — before falling back to the generic menu, check whether
  // the query at least signals a topic we could narrow down with one follow-up question.
  if (!best) {
    for (const trigger of AMBIGUOUS_TRIGGERS) {
      if (matchesOrderedPhrase(queryTokens, trigger.keyword)) {
        return {
          normalizedQuery,
          lang,
          // Prefixed rather than left null so this is distinguishable downstream from a
          // true unmatched query (the API route uses that distinction to decide whether
          // to attempt a live product/service lookup — an ambiguous-trigger question is
          // already a resolved, useful response, not a gap).
          matchedEntryId: `ambiguous:${trigger.keyword}`,
          entry: null,
          response: {
            canResolve: true,
            response: greeting ? `${greeting}${trigger.question[lang]}` : trigger.question[lang],
            suggestedActions: trigger.options[lang],
            priority: 'low',
          },
        }
      }
    }

    if (matchesEntry(queryTokens, PRODUCT_DISCOVERY) > 0) {
      best = PRODUCT_DISCOVERY
    }
  }

  if (!best) {
    return {
      normalizedQuery,
      lang,
      matchedEntryId: null,
      entry: null,
      response: {
        canResolve: true,
        response: greeting ? `${greeting}${DEFAULT_ANSWER[lang]}` : DEFAULT_ANSWER[lang],
        suggestedActions: DEFAULT_ACTIONS[lang],
        priority: 'low',
      },
    }
  }

  return {
    normalizedQuery,
    lang,
    matchedEntryId: best.id,
    entry: best,
    response: {
      canResolve: true,
      response: best.answer[lang],
      suggestedActions: best.actions[lang],
      priority: 'medium',
    },
  }
}

export function getFaqResponse(query: string, context?: { userName?: string }): FaqResponse {
  return matchFaq(query, context).response
}
