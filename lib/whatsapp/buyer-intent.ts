// Extracts the item phrase from common buyer questions without interpreting product
// facts or making a purchase decision. Unknown phrasing stays with the caller.
export function requestedItem(text: string): string | null {
  const match = text.trim().match(/^(?:(?:hi|hello|hey|please|abeg|pls|biko|good (?:morning|afternoon|evening))[,!\s]+)*(?:i(?:'m| am)?\s*(?:want|wan|need|looking for|dey find|dey look for|wish to|would love)|i(?:'d| would) like|can (?:i|you) (?:buy|find|get|send|show)|could you (?:find|show|send)|do you (?:have|sell|get)|una (?:get|dey sell|sell)|you (?:get|dey sell)|show me|find me|send me|give me|looking for|please (?:show|find|send)|how much (?:is|are|for|be)|(?:what(?:'s| is) (?:the )?)?(?:price|cost) (?:of|for)|(?:the )?price (?:of|for))\s+(.+)$/i)
  if (!match) return null
  const item = match[1]
    .replace(/^(?:to\s+)?(?:buy|purchase|find|get|see|order|check|know)\s+/i, '')
    .replace(/^(?:me\s+)?(?:the\s+)?(?:price|cost)\s+(?:of|for)\s+/i, '')
    .replace(/^(?:a|an|some|the|one|dis|this)\s+/i, '')
    .replace(/\s+(?:please|pls|abeg|biko|o|oo|na|now|sha)\s*$/i, '')
    .replace(/[?.!\s]+$/g, '')
    .trim()
  return item.length >= 2 && item.length <= 80 ? item : null
}

export function splitShoppingList(text: string): string[] {
  // A comma inside ₦20,000 is part of a price, not a second item.
  return text.split(/,\s*(?=[a-z])/i).map((item) => item.trim()).filter(Boolean)
}
