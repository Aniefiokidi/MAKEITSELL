function naira(amount: unknown): string {
  return `NGN ${Math.max(0, Number(amount) || 0).toLocaleString('en-NG')}`
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function selectProductVariants(
  productName: string,
  variants: Array<{ label: string; value: string; stock: number }>,
  reply: string,
  quantity: number
): { selected: Array<{ label: string; value: string }>; prompt?: string } {
  if (variants.length === 0) return { selected: [] }
  const labels = Array.from(new Set(variants.map((variant) => variant.label)))
  const selected: Array<{ label: string; value: string }> = []
  for (const label of labels) {
    const options = variants.filter((variant) => variant.label === label && variant.stock > 0)
    if (options.length === 0) return { selected: [], prompt: `No ${label.toLowerCase()} option is in stock for ${productName} right now.` }
    const allForLabel = variants.filter((variant) => variant.label === label)
    const mentioned = allForLabel.filter((option) => new RegExp(`\\b${escapeRegex(label)}\\s*:?\\s*${escapeRegex(option.value)}(?=\\s|[,;.!?]|$)`, 'i').test(reply))
    const requested = mentioned.length === 1 ? mentioned[0] : null
    if (requested && requested.stock <= 0) {
      return { selected: [], prompt: `${productName} (${label}: ${requested.value}) is out of stock. Available: ${options.slice(0, 8).map((option) => option.value).join(', ')}.` }
    }
    const labelWasMentioned = new RegExp(`\\b${escapeRegex(label)}\\b`, 'i').test(reply)
    const choice = requested || (!labelWasMentioned && options.length === 1 ? options[0] : null)
    if (!choice) {
      const choices = options.slice(0, 8).map((option) => option.value).join(', ')
      return { selected: [], prompt: `Choose ${label} for ${productName}: ${choices}. Reply like "add ${label} ${options[0].value}"${labels.length > 1 ? ' and include each option (e.g. color and size)' : ''}.` }
    }
    if (choice.stock < quantity) {
      return { selected: [], prompt: `Only ${choice.stock} of ${productName} (${label}: ${choice.value}) are in stock. Choose a smaller quantity.` }
    }
    selected.push({ label, value: choice.value })
  }
  return { selected }
}

export function answerProductQuestion(product: any, message: string): string {
  const text = message.trim().toLowerCase()
  const name = String(product?.name || 'This product')

  if (/\b(how much|price|cost)\b/.test(text)) {
    return `${name} is listed at ${naira(product?.price)}. Delivery is calculated at checkout from your address. Reply "add" to add it to your cart.`
  }
  if (/\b(available|availability|in stock|stock|do you have it)\b/.test(text)) {
    const stock = Number(product?.stock)
    if (product?.status !== 'active' || (Number.isFinite(stock) && stock <= 0)) {
      return `${name} is currently unavailable. Search for another item or type "categories" to browse.`
    }
    const variants: any[] = Array.isArray(product?.variants) ? product.variants : []
    const mentioned = variants.find((variant) =>
      new RegExp(`\\b${escapeRegex(String(variant.label))}\\s*:?\\s*${escapeRegex(String(variant.value))}(?=\\s|[?.!,]|$)`, 'i').test(message)
    )
    if (mentioned) {
      const count = Number(mentioned.stock) || 0
      return count > 0
        ? `${name} (${mentioned.label}: ${mentioned.value}) shows ${count} unit${count === 1 ? '' : 's'} in stock. Reply "add ${mentioned.label} ${mentioned.value}" to continue.`
        : `${name} (${mentioned.label}: ${mentioned.value}) is currently out of stock. Ask about another option.`
    }
    if (!Number.isFinite(stock)) {
      return `${name} is listed as available, but I can't confirm a unit count. Availability is checked at checkout.`
    }
    return stock === 9999
      ? `${name} is listed as available. Reply "add" to add it to your cart.`
      : `${name} shows ${stock} unit${stock === 1 ? '' : 's'} in stock. Specific color or size availability may differ. Reply "add" to continue.`
  }
  if (/\b(colou?rs?|sizes?|variants?|options?)\b/.test(text)) {
    const variants: any[] = Array.isArray(product?.variants) ? product.variants : []
    const available = variants.filter((variant) => Number(variant?.stock) > 0)
    const grouped = new Map<string, string[]>()
    for (const variant of available) {
      const label = String(variant?.label || 'Option').trim()
      const value = String(variant?.value || '').trim()
      if (value) grouped.set(label, [...(grouped.get(label) || []), value])
    }
    if (grouped.size > 0) {
      const lines = Array.from(grouped, ([label, values]) => `${label}: ${Array.from(new Set(values)).slice(0, 8).join(', ')}`).slice(0, 4)
      return `${name} options currently listed:\n${lines.join('\n')}\n\nReply "add" to continue. Final availability is checked at checkout.`
    }
    const colors = Array.isArray(product?.colors) ? product.colors.filter(Boolean) : []
    const sizes = Array.isArray(product?.sizes) ? product.sizes.filter(Boolean) : []
    if (colors.length || sizes.length) {
      return `${name} lists:${colors.length ? `\nColors: ${colors.slice(0, 8).join(', ')}` : ''}${sizes.length ? `\nSizes: ${sizes.slice(0, 8).join(', ')}` : ''}\n\nAvailability is confirmed at checkout.`
    }
    return `I don't have color or size details for ${name}. The listing may have more details. Reply "add" to continue.`
  }
  if (/\b(delivery|shipping|ship)\b/.test(text)) {
    return `Delivery options and prices for ${name} are calculated at checkout using your address. Reply "add" to put it in your cart first.`
  }
  if (/\b(describe|description|details|tell me about)\b/.test(text)) {
    const description = String(product?.description || '').trim()
    return description
      ? `${name}: ${description.slice(0, 450)}${description.length > 450 ? '…' : ''}\n\nReply "add" to continue.`
      : `I don't have more details for ${name}. It is listed at ${naira(product?.price)}. Reply "add" to continue.`
  }
  return `${name} is listed at ${naira(product?.price)}. You can ask about price, stock, colors, sizes, or delivery. Reply "add" or a quantity (e.g. "2") to add it to your cart.`
}
