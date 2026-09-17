// Memory of the product cards the bot most recently sent, so a buyer can refer to them
// the way they would with a human — "the first one", "2", "add the red one", or just
// "yes" / "how much?" when only one card was shown — without long-pressing to reply.
// The cards are numbered when sent (product-results.ts) so "2" is unambiguous.

export interface RecentResult {
  id: string
  kind: 'product' | 'service'
  messageId: string
  name: string
  price?: number
}

export type ResultReference =
  | { kind: 'item'; index: number; remainder: string }
  // "the third one" when only two cards were sent.
  | { kind: 'out_of_range'; requested: number }
  // "the black one" when nothing on screen is black — the word to search for instead.
  | { kind: 'unknown_word'; word: string }
  // "I'll take both", "add all"
  | { kind: 'all'; remainder: string }
  // "which is better?", "compare them", "what's the difference?"
  | { kind: 'compare' }
  // An action/question that clearly targets a card but doesn't say which of several.
  | { kind: 'ambiguous'; remainder: string }

const ORDINALS: Record<string, number> = {
  first: 1, '1st': 1, second: 2, '2nd': 2, third: 3, '3rd': 3, fourth: 4, '4th': 4, fifth: 5, '5th': 5,
}

const INDEX_REF = /(?:^|\s)(?:the\s+)?(?:number|no\.?|option|item|#|card)?\s*(\d{1,2}|first|second|third|fourth|fifth|last|1st|2nd|3rd|4th|5th)(?:\s+one)?(?=$|[\s?.!,])/i
const WORD_REF = /(?:^|\s)(?:the\s+)?([a-z][a-z-]{2,})\s+one(?=$|[\s?.!,])/i
// Things a buyer says ABOUT a card rather than as a new search.
// Service-card follow-ups: "send me their number", "contact", "book", "call them".
export const SERVICE_FOLLOW_UP = /^(?:(?:send|give) me (?:the |their |his |her )?(?:number|contact|details|whatsapp)|(?:their |his |her )?(?:number|contact|contacts|details)|contact (?:them|him|her|the provider)|book(?: (?:them|him|her|it|now))?|call (?:them|him|her)|i want to book|how do i (?:book|contact|reach) (?:them|him|her))[\s?.!]*$/i
const IMPLICIT_ACTION = /^(?:yes|yeah|yup|yh|add|buy|take it|i(?:'ll| will) take it|i want(?: it)?|i(?:'d| would) like(?: it)?|this|that|this one|that one|one)(?:\s+\d{1,2})?[\s!.]*$/i
const IMPLICIT_QUESTION = /^(?:how much|price|(?:send|show) (?:me )?(?:the |a |more )?(?:picture|photo|image|pic)s?|(?:picture|photo|image|pic)s?\??|what(?:'s| is) the price|is it|does it|do you have it|are they|is there|available|in stock|what colou?rs?|what sizes?|which sizes?|which colou?rs?|colou?rs?\?*|sizes?\?*|describe|details|tell me (?:more|about it)|delivery|shipping|is this|can i get it|do you deliver it)\b/i
const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 }
// "2 of the black one", "three of number 1", "I want 2 of the first one"
const QUANTITY_OF_REF = /^(?:i want|i need|add|buy|give me|send me|i(?:'d| would) like)?\s*(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:pcs|pieces|units|pairs?)?\s*(?:of|x)\s+(.+)$/i
const QUANTITY_ONLY = /^(?:add|buy|i want|i(?:'d| would) like|give me|send me|i(?:'ll| will) take)?\s*(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)(?:\s*(?:pcs|pieces|units|pairs?))?[\s!.]*$/i
const CHEAPER_REF = /(?:^|\s)(?:the\s+)?(?:cheap(?:er|est)|lowest|less expensive|affordable|budget)\s+(?:one|option|price)?(?=$|[\s?.!,])/i
const PRICIER_REF = /(?:^|\s)(?:the\s+)?(?:(?:more )?expensive|pricier|priciest|costlier|dearer|dearest|higher|better quality|premium)\s+(?:one|option)?(?=$|[\s?.!,])/i
const ALL_REF = /^(?:(?:add|buy|i want|i(?:'ll| will) take|take|give me|send me)\s+)?(?:both|all|all of them|both of them|everything|the two|all two|all three|all four)(?:\s+of them)?[\s!.]*$/i
const COMPARE_REF = /^(?:which (?:one )?(?:is|be) (?:better|best|good|nicer|stronger|more durable|the best)|compare(?: them| both| the two)?|what(?:'s| is) the difference|difference\??|which (?:one )?(?:do you|would you) (?:recommend|suggest|advise)|recommend one|which (?:one )?should i (?:buy|take|pick|choose|go for))[\s?.!]*$/i

function stripRef(text: string, match: RegExpMatchArray): string {
  const start = match.index ?? 0
  return `${text.slice(0, start)} ${text.slice(start + match[0].length)}`.replace(/\s+/g, ' ').replace(/^[\s,:-]+|[\s,:-]+$/g, '').trim()
}

// Resolves what a message refers to among `results`, or null when it isn't a reference
// at all (a fresh search, a keyword, a question with no card in mind).
export function parseResultReference(text: string, results: RecentResult[]): ResultReference | null {
  const trimmed = String(text || '').trim()
  if (!trimmed || results.length === 0) return null
  const count = results.length

  if (ALL_REF.test(trimmed)) return { kind: 'all', remainder: 'add' }
  if (COMPARE_REF.test(trimmed)) return count === 1 ? { kind: 'item', index: 0, remainder: 'details' } : { kind: 'compare' }

  // "the cheaper one" / "the expensive one" — by price, when we know prices.
  const priced = results.map((r, i) => ({ i, price: Number(r.price) })).filter((r) => Number.isFinite(r.price))
  if (priced.length === count && count > 1) {
    const cheaper = trimmed.match(CHEAPER_REF)
    const pricier = !cheaper && trimmed.match(PRICIER_REF)
    if (cheaper || pricier) {
      const pick = priced.reduce((best, r) => (cheaper ? r.price < best.price : r.price > best.price) ? r : best, priced[0])
      return { kind: 'item', index: pick.i, remainder: stripRef(trimmed, (cheaper || pricier) as RegExpMatchArray) }
    }
  }

  const quantityOf = trimmed.match(QUANTITY_OF_REF)
  if (quantityOf) {
    const n = NUMBER_WORDS[quantityOf[1].toLowerCase()] ?? Number(quantityOf[1])
    const inner = parseResultReference(quantityOf[2], results)
    if (inner?.kind === 'item' && n >= 1) return { kind: 'item', index: inner.index, remainder: `add ${n}` }
    if (inner?.kind === 'out_of_range' || inner?.kind === 'unknown_word') return inner
    // "2 of it/this/that/them" with one card on screen — but not "2 of the black one"
    // when the only card is red.
    if (count === 1 && n >= 1 && /^(?:the\s+)?(?:it|this|that|this one|that one|them|those|these|same)$/i.test(quantityOf[2].trim())) {
      return { kind: 'item', index: 0, remainder: `add ${n}` }
    }
    return null
  }

  // "2", "add 2", "I want 2": with several cards that's card 2; with one card it's a
  // quantity of it.
  const quantity = trimmed.match(QUANTITY_ONLY)
  if (quantity) {
    const n = NUMBER_WORDS[quantity[1].toLowerCase()] ?? Number(quantity[1])
    if (count === 1) return { kind: 'item', index: 0, remainder: `add ${n}` }
    if (n >= 1 && n <= count) return { kind: 'item', index: n - 1, remainder: 'add' }
    // "I want five" with two cards: a quantity, but of which one?
    if (n > count && /^(?:i want|i(?:'d| would) like|give me|send me|i(?:'ll| will) take|add|buy)\b/i.test(trimmed)) return { kind: 'ambiguous', remainder: `add ${n}` }
    return null
  }

  const byIndex = trimmed.match(INDEX_REF)
  if (byIndex) {
    const token = byIndex[1].toLowerCase()
    const n = token === 'last' ? count : ORDINALS[token] ?? Number(token)
    if (Number.isInteger(n) && n >= 1 && n <= count) {
      return { kind: 'item', index: n - 1, remainder: stripRef(trimmed, byIndex) }
    }
    if (Number.isInteger(n) && n > count && (ORDINALS[token] !== undefined || /(?:number|no\.?|option|item|#|card)/i.test(byIndex[0]))) {
      return { kind: 'out_of_range', requested: n }
    }
  }

  const byWord = trimmed.match(WORD_REF)
  if (byWord) {
    const word = byWord[1].toLowerCase()
    const hits = results.map((r, i) => ({ i, name: r.name.toLowerCase() })).filter((r) => new RegExp(`\\b${word}`, 'i').test(r.name))
    if (hits.length === 1) return { kind: 'item', index: hits[0].i, remainder: stripRef(trimmed, byWord) }
    if (hits.length === 0 && !/^(?:this|that|which|other|another|same|next|last|first|cheap|cheaper|cheapest|good|nice|better|best)$/.test(word)) {
      return { kind: 'unknown_word', word }
    }
  }

  if (results.every((r) => r.kind === 'service') && SERVICE_FOLLOW_UP.test(trimmed)) {
    if (count === 1) return { kind: 'item', index: 0, remainder: trimmed }
    return { kind: 'ambiguous', remainder: trimmed }
  }
  if (IMPLICIT_ACTION.test(trimmed) || IMPLICIT_QUESTION.test(trimmed)) {
    if (count === 1) return { kind: 'item', index: 0, remainder: trimmed }
    return { kind: 'ambiguous', remainder: trimmed }
  }
  return null
}

export function listRecentResults(results: RecentResult[]): string {
  return results.map((r, i) => `${i + 1}. ${r.name}`).join('\n')
}
