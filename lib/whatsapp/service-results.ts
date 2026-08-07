// Service-result presentation for the WhatsApp buyer bot — the services-mode counterpart
// to lib/whatsapp/product-results.ts. Kept as a separate module (not a shared generic)
// because the two content shapes genuinely differ: a service has packages/add-ons and an
// optional quote flag that a product doesn't.
import { Store } from '@/lib/models/Store'
import { sendTextMessage, sendImageMessage } from '@/lib/whatsapp/client'

async function trySendText(waId: string, body: string): Promise<void> {
  try {
    await sendTextMessage(waId, body)
  } catch (error) {
    console.error(`[whatsapp-service-results] Text send failed for ${waId}:`, error)
  }
}

async function trySendImage(waId: string, imageUrl: string, caption: string): Promise<void> {
  try {
    await sendImageMessage(waId, imageUrl, caption)
  } catch (error) {
    console.error(`[whatsapp-service-results] Image send failed for ${waId}:`, error)
  }
}

function formatNaira(amount: number): string {
  return `NGN ${Math.max(0, Number(amount) || 0).toLocaleString('en-NG')}`
}

// Same transform as product-results.ts's buildWhatsAppImageUrl — kept as its own copy
// rather than a shared import so this file has no dependency on that one (matches the
// existing split between image-search.ts and product-results.ts).
function buildWhatsAppImageUrl(url: string): string {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url
  return url.replace('/upload/', '/upload/w_800,q_auto,f_auto/')
}

// service.packageOptions/images are guaranteed non-empty by normalizeServicePricing()
// (lib/mongodb-operations.ts) before this ever sees the object — it always synthesizes a
// fallback package from the flat price, and falls back images -> package images ->
// providerImage. So no "no packages" branch is needed here, only "more than one".
function buildServiceCaption(service: any, storeName?: string): string {
  const title = String(service?.title || 'Service')
  const provider = storeName || String(service?.providerName || 'Make It Sell')
  const packages = (Array.isArray(service?.packageOptions) ? service.packageOptions : []).filter((p: any) => p?.active !== false)
  const requiresQuote = Boolean(service?.requiresQuote)

  const priceLine = requiresQuote
    ? `Custom quote — from ${formatNaira(service?.price)}`
    : packages.length > 1
      ? `From ${formatNaira(service?.price)}`
      : formatNaira(service?.price)

  const lines = [title, priceLine, `By ${provider}`]

  if (packages.length > 1) {
    const shown = packages.slice(0, 3).map((p: any) => `- ${p.name}: ${formatNaira(p.price)}`)
    lines.push('', 'Packages:', ...shown)
    if (packages.length > 3) lines.push(`(+${packages.length - 3} more)`)
  }

  const addOns = (Array.isArray(service?.addOnOptions) ? service.addOnOptions : []).filter((a: any) => a?.active !== false)
  if (addOns.length > 0) {
    const shown = addOns.slice(0, 3).map((a: any) =>
      `- ${a.name}: ${a.pricingType === 'percentage' ? `+${a.amount}%` : `+${formatNaira(a.amount)}`}`
    )
    lines.push('', 'Add-ons:', ...shown)
    if (addOns.length > 3) lines.push(`(+${addOns.length - 3} more)`)
  }

  if (requiresQuote) {
    lines.push('', 'Final price is confirmed by the provider after booking.')
  }

  return lines.join('\n')
}

async function sendResultItem(waId: string, service: any, storeName?: string): Promise<void> {
  const caption = buildServiceCaption(service, storeName)
  const rawImage = Array.isArray(service?.images) ? service.images[0] : undefined

  if (!rawImage) {
    await trySendText(waId, caption)
    return
  }

  await trySendImage(waId, buildWhatsAppImageUrl(rawImage), caption)
}

// Batch-resolves store names for a page of services, then sends them all concurrently.
// Services denormalize providerName from the vendor's personal display name (see
// app/vendor/services/new/page.tsx), not the store brand — same mismatch product-results
// solves via a Store lookup, just keyed by vendorId here since Service has no storeId
// field of its own.
export async function sendServiceResults(waId: string, services: any[]): Promise<void> {
  const providerIds = Array.from(new Set(services.map((s) => String((s as any)?.providerId || '')).filter(Boolean)))
  const stores = providerIds.length > 0 ? await Store.find({ vendorId: { $in: providerIds } }).select('storeName vendorId').lean() : []
  const storeNameByProviderId = new Map((stores as any[]).map((s) => [String(s.vendorId), String(s.storeName || '')]))

  await Promise.all(
    services.map((service) => sendResultItem(waId, service, storeNameByProviderId.get(String((service as any)?.providerId || ''))))
  )
}
