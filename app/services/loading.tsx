import Header from "@/components/Header"

export default function ServicesLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <div className="mb-6 h-10 w-64 rounded-full bg-muted animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, idx) => (
            <div key={idx} className="rounded-2xl border border-border/70 p-4 shadow-sm">
              <div className="h-40 w-full rounded-xl bg-muted animate-pulse" />
              <div className="mt-4 h-5 w-3/4 rounded bg-muted animate-pulse" />
              <div className="mt-2 h-4 w-1/2 rounded bg-muted animate-pulse" />
              <div className="mt-4 h-9 w-full rounded-full bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
