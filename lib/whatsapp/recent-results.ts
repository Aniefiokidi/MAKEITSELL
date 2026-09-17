// Memory of the product cards the bot most recently sent, so a buyer can refer to them
// the way they would with a human — "the first one", "2", "add the red one", or just
// "yes" / "how much?" when only one card was shown — without long-pressing to reply.
// The cards are numbered when sent (product-results.ts) so "2" is unambiguous.

export interface RecentResult {
  productId: string
  messageId: string
  name: string
}

export type ResultReference =
  | { kind: 'item'; index: number; remainder: string }
  // "the third one" when only two cards were sent.
  | { kind: 'out_of_range'; requested: number }
  // An action/question that clearly targets a card but doesn't say which of several.
  | { kind: 'ambiguous'; remainder: string }

const ORDINALS: Record<string, number> = {
  first: 1, '1st': 1, second: 2, '2nd': 2, third: 3, '3rd': 3, fourth: 4, '4th': 4, fifth: 5, '5th': 5,
}

const INDEX_REF = /(?:^|\s)(?:the\s+)?(?:number|no\.?|option|item|#|card)?\s*(\d{1,2}|first|second|third|fourth|fifth|last|1st|2nd|3rd|4th|5th)(?:\s+one)?(?=$|[\s?.!,])/i
const WORD_REF = /(?:^|\s)(?:the\s+)?([a-z][a-z-]{2,})\s+one(?=$|[\s?.!,])/i
// Things a buyer says ABOUT a card rather than as a new search.
const IMPLICIT_ACTION = /^(?:yes|yeah|yup|yh|add|buy|take it|i(?:'ll| will) take it|i want(?: it)?|i(?:'d| would) like(?: it)?|this|that|this one|that one|one)(?:\s+\d{1,2})?[\s!.]*$/i
const IMPLICIT_QUESTION = /^(?:how much|price|what(?:'s| is) the price|is it|does it|do you have it|are they|is there|available|in stock|what colou?rs?|what sizes?|which sizes?|which colou?rs?|colou?rs?\?*|sizes?\?*|describe|details|tell me (?:more|about it)|delivery|shipping|is this|can i get it|do you deliver it)\b/i
const QUANTITY_ONLY = /^(?:add|buy|i want|i(?:'d| would) like|give me|send me)?\s*(\d{1,2})(?:\s*(?:pcs|pieces|units))?[\s!.]*$/i

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

  // "2", "add 2", "I want 2": with several cards that's card 2; with one card it's a
  // quantity of it.
  const quantity = trimmed.match(QUANTITY_ONLY)
  if (quantity) {
    const n = Number(quantity[1])
    if (count === 1) return { kind: 'item', index: 0, remainder: `add ${n}` }
    if (n >= 1 && n <= count) return { kind: 'item', index: n - 1, remainder: 'add' }
    return null
  }

  const byIndex = trimmed.match(INDEX_REF)
  if (byIndex) {
    const token = byIndex[1].toLowerCase()
    const n = token === 'last' ? count : ORDINALS[token] ?? Number(token)
    if (Number.isInteger(n) && n >= 1 && n <= count) {
      return { kind: 'item', index: n - 1, remainder: stripRef(trimmed, byIndex) }
    }
    if (Number.isInteger(n) && n > count && (ORDINALS[token] !== undefined || /^(?:the\s+)?(?:number|no\.?|option|item|#|card)/i.test(trimmed))) {
      return { kind: 'out_of_range', requested: n }
    }
  }

  const byWord = trimmed.match(WORD_REF)
  if (byWord) {
    const word = byWord[1].toLowerCase()
    const hits = results.map((r, i) => ({ i, name: r.name.toLowerCase() })).filter((r) => new RegExp(`\\b${word}`, 'i').test(r.name))
    if (hits.length === 1) return { kind: 'item', index: hits[0].i, remainder: stripRef(trimmed, byWord) }
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
