import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import Header from "@/components/Header"
import { JsonLd } from "@/components/seo/JsonLd"
import { optimizedImageUrl } from "@/lib/cloudinary-url"
import {
  SERVICE_CATEGORY_NAMES,
  getServiceRatings,
  getServicesForCategoryLocation,
  getStatesWithServiceInventory,
  resolveStateFromSlug,
} from "@/lib/seo-category-pages"

const SITE_URL = "https://www.makeitsell.ng"

type Params = { category: string; location: string }

async function loadPageData(params: Params) {
  const categoryName = SERVICE_CATEGORY_NAMES[params.category]
  const stateName = resolveStateFromSlug(params.location)
  if (!categoryName || !stateName) return null

  const [{ services, providerCount }, otherStates] = await Promise.all([
    getServicesForCategoryLocation(params.category, stateName, 24),
    getStatesWithServiceInventory(params.category, stateName, 6),
  ])

  return { categoryName, stateName, services, providerCount, otherStates }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const resolved = await params
  const data = await loadPageData(resolved)
  if (!data) return { title: "Service Not Found | MakeItSell" }

  const { categoryName, stateName, services } = data
  const title = `Book a ${categoryName} in ${stateName} | MakeItSell`
  const description = services.length > 0
    ? `Find and book ${services.length}+ trusted ${categoryName.toLowerCase()} providers in ${stateName}, Nigeria. Secure booking with escrow protection on MakeItSell.`
    : `Find ${categoryName.toLowerCase()} providers in ${stateName}, Nigeria on MakeItSell — book with secure escrow protection.`

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
    ...(services.length === 0 ? { robots: { index: false, follow: true } } : {}),
  }
}

export default async function BookCategoryLocationPage({ params }: { params: Promise<Params> }) {
  const resolved = await params
  const data = await loadPageData(resolved)
  if (!data) notFound()

  const { categoryName, stateName, services, providerCount, otherStates } = data
  const ratings = await getServiceRatings(services.map((s: any) => String(s._id)))

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Services", item: `${SITE_URL}/services/categories` },
      { "@type": "ListItem", position: 3, name: stateName, item: `${SITE_URL}/book/${resolved.category}/${resolved.location}` },
    ],
  }

  const itemListJsonLd = services.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: services.map((s: any, idx: number) => {
      const rating = ratings.get(String(s._id))
      const serviceUrl = `${SITE_URL}/service/${String(s._id)}`
      return {
        "@type": "ListItem",
        position: idx + 1,
        item: {
          "@type": "Service",
          name: s.title || categoryName,
          image: optimizedImageUrl(s.images?.[0], { width: 800 }),
          url: serviceUrl,
          areaServed: stateName,
          ...(s.providerName ? { provider: { "@type": "Organization", name: s.providerName } } : {}),
          offers: {
            "@type": "Offer",
            url: serviceUrl,
            priceCurrency: "NGN",
            price: Number(s.price || 0),
          },
          ...(rating ? {
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: rating.average,
              reviewCount: rating.count,
            },
          } : {}),
        },
      }
    }),
  } : null

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <JsonLd data={breadcrumbJsonLd} />
      {itemListJsonLd && <JsonLd data={itemListJsonLd} />}
      <Header />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <nav className="text-sm text-muted-foreground mb-4">
            <Link href="/" className="hover:text-accent">Home</Link>
            <span className="mx-2">/</span>
            <Link href="/services/categories" className="hover:text-accent">Services</Link>
            <span className="mx-2">/</span>
            <span>{stateName}</span>
          </nav>

          <h1 className="text-3xl font-bold mb-2">Book a {categoryName} in {stateName}</h1>
          <p className="text-muted-foreground max-w-2xl mb-8">
            {services.length > 0
              ? `Browse ${services.length}+ ${categoryName.toLowerCase()} providers based in ${stateName}, from ${providerCount} verified ${providerCount === 1 ? 'professional' : 'professionals'}. Every booking is protected — payment is held until the job is done.`
              : `We don't have ${categoryName.toLowerCase()} providers based in ${stateName} listed yet. Check the options below, or browse all services across Nigeria.`}
          </p>

          {services.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-10">
              {services.map((s: any) => (
                <Link
                  key={String(s._id)}
                  href={`/service/${String(s._id)}`}
                  className="group block rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow bg-card"
                >
                  <div className="aspect-square bg-muted relative overflow-hidden">
                    <img
                      src={optimizedImageUrl(s.images?.[0], { width: 400 })}
                      alt={s.title || categoryName}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium truncate">{s.title}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{s.providerName}</p>
                    <p className="text-accent font-bold text-sm mt-1">₦{Number(s.price || 0).toLocaleString('en-NG')}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-10 text-center mb-10">
              <p className="text-muted-foreground mb-4">No providers here yet.</p>
              <Link href="/services/categories" className="text-accent font-medium underline">
                Browse all service categories →
              </Link>
            </div>
          )}

          {otherStates.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-3">Book a {categoryName} in Other Cities</h2>
              <div className="flex flex-wrap gap-2">
                {otherStates.map((state) => (
                  <Link
                    key={state}
                    href={`/book/${resolved.category}/${state.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                    className="text-sm px-3 py-1.5 rounded-full border border-border hover:border-accent hover:text-accent transition-colors"
                  >
                    {categoryName} in {state}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="text-center">
            <Link href="/services/categories" className="text-sm text-muted-foreground hover:text-accent underline">
              Browse all service categories →
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
