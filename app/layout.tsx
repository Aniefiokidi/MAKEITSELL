import type React from "react"
import type { Metadata, Viewport } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { AuthProvider } from "@/contexts/AuthContext"
import { CartProvider } from "@/contexts/CartContext"
import { WishlistProvider } from "@/contexts/WishlistContext"
import GlobalClientProviders from "@/components/GlobalClientProviders"
import NotificationPermission from "@/components/NotificationPermission"
import { Suspense } from "react"
import Footer from "@/components/Footer"
import "./globals.css"

export const metadata: Metadata = {
  title: "Make It Sell",
  description: "AI-powered marketplace connecting buyers with quality products and professional services",
  generator: "v0.app",
  icons: {
    icon: "/images/mis-icon.png",
    shortcut: "/images/mis-icon.png",
    apple: "/images/mis-icon.png",
  },
  metadataBase: new URL('https://www.makeitsell.ng'),
  openGraph: {
    title: "Make It Sell",
    description: "AI-powered marketplace connecting buyers with quality products and professional services",
    url: "https://www.makeitsell.ng",
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
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
        <meta name="theme-color" content="#3d1218" />
        <link rel="manifest" href="/manifest.json" />

        {/* Android PWA */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="MIS" />

        {/* iOS PWA */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="MIS" />

        {/* iOS home-screen icons — Safari picks the closest size */}
        <link rel="apple-touch-icon" sizes="57x57"   href="/images/mis-icon.png" />
        <link rel="apple-touch-icon" sizes="60x60"   href="/images/mis-icon.png" />
        <link rel="apple-touch-icon" sizes="72x72"   href="/images/mis-icon.png" />
        <link rel="apple-touch-icon" sizes="76x76"   href="/images/mis-icon.png" />
        <link rel="apple-touch-icon" sizes="114x114" href="/images/mis-icon.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/images/mis-icon.png" />
        <link rel="apple-touch-icon" sizes="144x144" href="/images/mis-icon.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/images/mis-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/images/mis-icon.png" />
        <link rel="apple-touch-icon"                 href="/images/mis-icon.png" />

        {/* iOS splash screens — required for full-screen launch on iOS */}
        {/* iPhone SE / 5 */}
        <link rel="apple-touch-startup-image" media="(device-width: 320px) and (-webkit-device-pixel-ratio: 2)" href="/images/mis-icon.png" />
        {/* iPhone 6/7/8 */}
        <link rel="apple-touch-startup-image" media="(device-width: 375px) and (-webkit-device-pixel-ratio: 2)" href="/images/mis-icon.png" />
        {/* iPhone 6+/7+/8+ */}
        <link rel="apple-touch-startup-image" media="(device-width: 414px) and (-webkit-device-pixel-ratio: 3)" href="/images/mis-icon.png" />
        {/* iPhone X/Xs */}
        <link rel="apple-touch-startup-image" media="(device-width: 375px) and (-webkit-device-pixel-ratio: 3)" href="/images/mis-icon.png" />
        {/* iPhone Xs Max / 11 Pro Max */}
        <link rel="apple-touch-startup-image" media="(device-width: 414px) and (-webkit-device-pixel-ratio: 2)" href="/images/mis-icon.png" />
        {/* iPhone 11 / Xr */}
        <link rel="apple-touch-startup-image" media="(device-width: 828px) and (-webkit-device-pixel-ratio: 2)" href="/images/mis-icon.png" />
        {/* iPhone 12 / 13 / 14 */}
        <link rel="apple-touch-startup-image" media="(device-width: 390px) and (-webkit-device-pixel-ratio: 3)" href="/images/mis-icon.png" />
        {/* iPhone 14 Plus / 15 Plus */}
        <link rel="apple-touch-startup-image" media="(device-width: 430px) and (-webkit-device-pixel-ratio: 3)" href="/images/mis-icon.png" />
        {/* iPhone 14 Pro / 15 / 15 Pro / 16 */}
        <link rel="apple-touch-startup-image" media="(device-width: 393px) and (-webkit-device-pixel-ratio: 3)" href="/images/mis-icon.png" />
        {/* iPhone 16 Pro */}
        <link rel="apple-touch-startup-image" media="(device-width: 402px) and (-webkit-device-pixel-ratio: 3)" href="/images/mis-icon.png" />
        {/* iPhone 16 Pro Max */}
        <link rel="apple-touch-startup-image" media="(device-width: 440px) and (-webkit-device-pixel-ratio: 3)" href="/images/mis-icon.png" />
        {/* iPad */}
        <link rel="apple-touch-startup-image" media="(device-width: 768px) and (-webkit-device-pixel-ratio: 2)" href="/images/mis-icon.png" />
        {/* iPad Pro 11 */}
        <link rel="apple-touch-startup-image" media="(device-width: 834px) and (-webkit-device-pixel-ratio: 2)" href="/images/mis-icon.png" />
        {/* iPad Pro 12.9 */}
        <link rel="apple-touch-startup-image" media="(device-width: 1024px) and (-webkit-device-pixel-ratio: 2)" href="/images/mis-icon.png" />

        {/* Fallback favicon */}
        <link rel="icon" type="image/png" href="/images/mis-icon.png" />

        {/* Service worker registration */}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').catch(function() {});
            });
          }
        `}} />
      </head>
      <body
        className={`font-sans ${GeistSans.variable} ${GeistMono.variable} min-h-screen text-foreground`}
        suppressHydrationWarning={true}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <ThemeProvider>
          <Suspense fallback={null}>
            <AuthProvider>
              <CartProvider>
                <WishlistProvider>
                <GlobalClientProviders>
                  <div className="flex flex-col min-h-screen">
                    <main className="flex-1 flex flex-col">{children}</main>
                    <Footer />
                  </div>
                  <NotificationPermission />
                </GlobalClientProviders>
                </WishlistProvider>
              </CartProvider>
            </AuthProvider>
          </Suspense>
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}