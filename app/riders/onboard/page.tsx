import RetiredFeatureNotice from "@/components/RetiredFeatureNotice"

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

// Retired — deliveries are now dispatched and tracked automatically via Shipbubble's own
// courier network, so MakeItSell no longer onboards its own riders. RiderOnboardForm is
// kept in place (not deleted) for a clean revert if ever needed.
export default function RiderOnboardPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center bg-muted/30 px-4 py-10">
        <div className="w-full max-w-md">
          <RetiredFeatureNotice
            title="Rider sign-up retired"
            message="Deliveries are now handled by Shipbubble's courier network instead of MakeItSell's own riders. Rider sign-up is no longer available."
          />
        </div>
      </div>
    </div>
  )
}
