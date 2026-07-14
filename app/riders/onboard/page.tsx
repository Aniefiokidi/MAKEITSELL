import RiderOnboardForm from "@/components/riders/RiderOnboardForm"

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default function RiderOnboardPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center bg-muted/30 px-4 py-10">
        <div className="w-full max-w-md">
          <RiderOnboardForm />
        </div>
      </div>
    </div>
  )
}
