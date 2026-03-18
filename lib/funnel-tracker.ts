export type FunnelEventType = "store_visit" | "product_view" | "cart_add" | "checkout_start"

export async function trackFunnelEvent(
  vendorId: string | undefined,
  eventType: FunnelEventType,
  metadata?: Record<string, unknown>
) {
  if (!vendorId) return

  try {
    await fetch("/api/analytics/funnel-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendorId, eventType, metadata }),
      keepalive: true,
    })
  } catch (error) {
    console.warn("Funnel event tracking failed", error)
  }
}
