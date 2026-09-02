import Image from "next/image"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { ShieldCheck, Sparkles, Truck } from "lucide-react"

type Bullet = { icon: LucideIcon; text: string }

const COPY: Record<"login" | "signup" | "vendor-signup", { eyebrow: string; headline: string; subtext: string; bullets: Bullet[] }> = {
  login: {
    eyebrow: "Welcome back",
    headline: "Good to see you again",
    subtext: "Sign in to track orders, manage your store, and keep selling.",
    bullets: [
      { icon: ShieldCheck, text: "Secure payments and wallet protection on every order" },
      { icon: Truck, text: "Real-time delivery tracking from checkout to doorstep" },
      { icon: Sparkles, text: "Trusted by thousands of buyers and sellers across Nigeria" },
    ],
  },
  signup: {
    eyebrow: "Get started",
    headline: "Join Nigeria's growing marketplace",
    subtext: "Create a free account to start shopping — or selling — in minutes.",
    bullets: [
      { icon: Sparkles, text: "Free to join, no subscription required" },
      { icon: ShieldCheck, text: "Secure payments and wallet protection on every order" },
      { icon: Truck, text: "Real-time delivery tracking from checkout to doorstep" },
    ],
  },
  "vendor-signup": {
    eyebrow: "Sell on Make It Sell",
    headline: "Start selling in minutes",
    subtext: "Set up your store for free and reach buyers across Nigeria.",
    bullets: [
      { icon: Sparkles, text: "Free to start, no subscription fees" },
      { icon: ShieldCheck, text: "Secure, instant wallet payouts on every sale" },
      { icon: Truck, text: "Built-in delivery for both goods and services" },
    ],
  },
}

export function AuthShell({
  variant,
  children,
}: {
  variant: "login" | "signup" | "vendor-signup"
  children: React.ReactNode
}) {
  const copy = COPY[variant]

  return (
    <div className="min-h-screen flex">
      {/* Brand panel — hidden on small screens, where the form alone is the whole page. */}
      <div className="hidden md:flex md:w-1/2 lg:w-[45%] relative flex-col justify-between overflow-hidden bg-gradient-to-br from-accent to-[oklch(0.16_0.06_15)] text-white p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/5 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 h-72 w-72 rounded-full bg-white/5 blur-3xl"
        />

        <Link href="/" className="relative text-2xl font-black italic tracking-tight">
          MAKEITSELL
        </Link>

        <div className="relative space-y-8">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-widest text-white/70">{copy.eyebrow}</p>
            <h1 className="text-4xl font-bold leading-tight text-balance">{copy.headline}</h1>
            <p className="text-white/80 text-lg leading-relaxed max-w-md">{copy.subtext}</p>
          </div>

          <ul className="space-y-4">
            {copy.bullets.map((bullet) => (
              <li key={bullet.text} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <bullet.icon className="h-4 w-4" />
                </span>
                <span className="text-white/90 leading-relaxed pt-1">{bullet.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex justify-end">
          <Image
            src="/images/cart-mascot-icon.png"
            alt=""
            width={220}
            height={150}
            className="opacity-90"
          />
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-16">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  )
}
