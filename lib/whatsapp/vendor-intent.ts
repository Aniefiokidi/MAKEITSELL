// Natural phrasings for the vendor commands, so a seller can say "how much did I make
// this week" instead of exactly "sales week". Pure text -> intent; commands.ts acts.
export type VendorIntent =
  | { kind: 'balance' }
  | { kind: 'sales'; period: 'today' | 'week' }
  | { kind: 'dispatched'; ref: string }          // order ref or "1" from the last list
  | { kind: 'orders' }                           // orders waiting to be shipped
  | { kind: 'help' }
  | { kind: 'greeting' }

const REF = '([A-Za-z0-9-]{1,24})'

export function parseVendorIntent(text: string): VendorIntent | null {
  const t = String(text || '').trim()
  const lower = t.toLowerCase()
  if (!t) return null

  if (/^(?:hi|hello|hey|good (?:morning|afternoon|evening|day)|morning|howfar|how far|wetin dey)[\s!.?]*$/i.test(t)) return { kind: 'greeting' }
  if (/^(?:help|commands|menu|what can you do|\?)[\s!.?]*$/i.test(t)) return { kind: 'help' }

  if (/^balance$|\b(?:my |wallet |account |available )?balance\b|\bhow much (?:do i have|is in my (?:wallet|account))|\bmy wallet\b|\bwallet\b/i.test(t)) return { kind: 'balance' }

  const salesWeek = /\b(?:this week|week|last 7 days|7 days|weekly)\b/i.test(t)
  if (/^sales\b|\bsales\b|\bhow much (?:did|have) i (?:make|made|sell|sold|earn|earned)|\bhow many (?:orders|sales)\b|\brevenue\b|\bmy (?:earnings|income)\b|\bwetin i sell\b|\bhow (?:is|are) (?:my )?sales\b|\bmoney (?:made|i made)\b/i.test(t)) {
    return { kind: 'sales', period: salesWeek ? 'week' : 'today' }
  }

  // "dispatched AB12CD34", "shipped AB12CD34", "I have sent order AB12CD34", "order AB12CD34 shipped",
  // "mark AB12CD34 as shipped", "dispatched 1" (from the last orders list)
  const d1 = t.match(new RegExp(`^(?:i(?:'ve| have)? )?(?:dispatched|shipped|sent(?: out)?|delivered to courier|handed over|posted)\\s+(?:order\\s+)?#?${REF}[\\s!.]*$`, 'i'))
  const d2 = t.match(new RegExp(`^(?:mark\\s+)?(?:order\\s+)?#?${REF}\\s+(?:as\\s+)?(?:dispatched|shipped|sent(?: out)?|is out|has gone out|don go)[\\s!.]*$`, 'i'))
  const d3 = t.match(new RegExp(`^(?:mark|set)\\s+(?:order\\s+)?#?${REF}\\s+(?:as\\s+)?(?:dispatched|shipped)[\\s!.]*$`, 'i'))
  const dispatched = d1 || d2 || d3
  if (dispatched) return { kind: 'dispatched', ref: dispatched[1] }

  if (/^(?:orders?|my orders|new orders?|pending orders?|orders? to (?:ship|dispatch|send)|what (?:do|should|must) i (?:need to |have to |still )?(?:ship|send|dispatch|deliver)|anything to ship|unshipped|to ship|any (?:new )?orders?)[\s?!.]*$/i.test(t)) return { kind: 'orders' }
  if (lower === 'orders') return { kind: 'orders' }
  return null
}
