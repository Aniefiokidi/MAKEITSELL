import TrackingView from "@/components/tracking/TrackingView"

export default async function TrackPage({ params }: { params: Promise<{ trackingToken: string }> }) {
  const { trackingToken } = await params

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <TrackingView trackingToken={trackingToken} />
    </div>
  )
}
