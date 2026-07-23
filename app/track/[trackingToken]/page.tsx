import TrackingView from "@/components/tracking/TrackingView"
import RetiredFeatureNotice from "@/components/RetiredFeatureNotice"

// Retired — deliveries are now dispatched and tracked automatically via Shipbubble's own
// tracking pages (see order.vendors[].shipbubbleTrackingUrl). TrackingView is kept in
// place (not deleted) for a clean revert if ever needed.
export default async function TrackPage({ params }: { params: Promise<{ trackingToken: string }> }) {
  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <RetiredFeatureNotice
        title="Live rider tracking retired"
        message="Deliveries are now tracked directly through the courier handling your order. Use the tracking link on your order page instead."
      />
    </div>
  )

  const { trackingToken } = await params
  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <TrackingView trackingToken={trackingToken} />
    </div>
  )
}
