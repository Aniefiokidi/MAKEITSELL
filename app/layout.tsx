import type React from "react"
import dynamic from "next/dynamic"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { AuthProvider } from "@/contexts/AuthContext"
import { CartProvider } from "@/contexts/CartContext"
import GlobalClientProviders from "@/components/GlobalClientProviders"
import { Suspense } from "react"
import Footer from "@/components/Footer"
import "./globals.css"

export const metadata: Metadata = {
  title: "Make It Sell",
  description: "AI-powered marketplace connecting buyers with quality products and professional services",
  generator: "v0.app",
  icons: {
    icon: "/images/logo2.png",
    shortcut: "/images/logo2.png",
    apple: "/images/logo2.png",
  },
  metadataBase: new URL('https://www.makeitsell.org'),
  openGraph: {
    title: "Make It Sell",
    description: "AI-powered marketplace connecting buyers with quality products and professional services",
    url: "https://www.makeitsell.org",
    siteName: "Make It Sell",
    type: "website",
    images: [
      {
        url: "/images/logo2.png",
        width: 1200,
        height: 630,
        alt: "Make It Sell",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Make It Sell",
    description: "AI-powered marketplace connecting buyers with quality products and professional services",
    images: ["/images/logo2.png"],
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
        <meta name="theme-color" content="#f5e3e6" />
      </head>
      <body
        className={`font-sans ${GeistSans.variable} ${GeistMono.variable} min-h-screen text-foreground`}
        suppressHydrationWarning={true}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Suspense fallback={null}>
            <AuthProvider>
              <CartProvider>
                <GlobalClientProviders>
                  <div className="flex flex-col min-h-screen">
                    <main className="flex-1 flex flex-col">{children}</main>
                    <Footer />
                  </div>
                </GlobalClientProviders>
              </CartProvider>
            </AuthProvider>
          </Suspense>
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}