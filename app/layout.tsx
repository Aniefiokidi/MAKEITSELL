import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { AuthProvider } from "@/contexts/AuthContext"
import { CartProvider } from "@/contexts/CartContext"
import { Suspense } from "react"
import FooterReveal from "@/components/FooterReveal"
import "./globals.css"

export const metadata: Metadata = {
  title: "Make It Sell - The Marketplace",
  description: "AI-powered marketplace with unified customer service - Make It Sell",
  generator: "v0.app",
  icons: {
    icon: "/images/logo2.png",
    shortcut: "/images/logo2.png",
    apple: "/images/logo2.png",
  },
  // Performance optimizations
  other: {
    "preload": "true",
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const ThemeProvider = require("@/components/theme-provider").ThemeProvider;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body
        className={`font-sans ${GeistSans.variable} ${GeistMono.variable} min-h-screen bg-background text-foreground`}
        suppressHydrationWarning={true}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Suspense fallback={null}>
            <AuthProvider>
              <CartProvider>
                <div className="min-h-screen flex flex-col">
                  <main className="flex-1 flex flex-col">{children}</main>
                  <FooterReveal />
                </div>
              </CartProvider>
            </AuthProvider>
          </Suspense>
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
