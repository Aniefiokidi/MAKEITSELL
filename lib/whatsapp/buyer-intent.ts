// Extracts the item phrase from common buyer questions without interpreting product
// facts or making a purchase decision. Unknown phrasing stays with the caller.
export function requestedItem(text: string): string | null {
  const match = text.trim().match(/^(?:(?:hi|hello|hey|please|abeg)[,!\s]+)*(?:i(?:'m| am)?\s*(?:want|wan|need|looking for)|i(?:'d| would) like|can i (?:buy|find|get)|do you have|show me|find me|looking for|please (?:show|find)|how much (?:is|are|for)|(?:what(?:'s| is) (?:the )?)?price (?:of|for))\s+(.+)$/i)
  if (!match) return null
  const item = match[1].replace(/^(?:to\s+)?(?:buy|purchase|find|get|see|order)\s+/i, '').replace(/^(?:a|an|some|the)\s+/i, '').replace(/[?.!\s]+$/g, '').trim()
  return item.length >= 2 && item.length <= 80 ? item : null
}

export function splitShoppingList(text: string): string[] {
  // A comma inside ₦20,000 is part of a price, not a second item.
  return text.split(/,\s*(?=[a-z])/i).map((item) => item.trim()).filter(Boolean)
}
