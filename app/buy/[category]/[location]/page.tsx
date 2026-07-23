import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import Header from "@/components/Header"
import { JsonLd } from "@/components/seo/JsonLd"
import { optimizedImageUrl } from "@/lib/cloudinary-url"
import {
  getProductRatings,
  getProductsForCategoryLocation,
  getStatesWithProductInventory,
  resolveProductCategoryFromSlug,
  resolveStateFromSlug,
} from "@/lib/seo-category-pages"

const SITE_URL = "https://www.makeitsell.ng"

type Params = { category: string; location: string }

async function loadPageData(params: Params) {
  const category = await resolveProductCategoryFromSlug(params.category)
  const stateName = resolveStateFromSlug(params.location)
  if (!category || !stateName) return null
  const { dbValue, displayName: categoryName } = category

  const [{ products, vendorCount }, otherStates] = await Promise.all([
    getProductsForCategoryLocation(dbValue, stateName, 24),
    getStatesWithProductInventory(dbValue, stateName, 6),
  ])

  return { categoryName, stateName, products, vendorCount, otherStates }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const resolved = await params
  const data = await loadPageData(resolved)
  if (!data) return { title: "Category Not Found | MakeItSell" }

  const { categoryName, stateName, products } = data
  const title = `Buy ${categoryName} in ${stateName} | MakeItSell`
  const description = products.length > 0
    ? `Shop ${products.length}+ ${categoryName.toLowerCase()} listings from verified vendors in ${stateName}, Nigeria. Secure escrow payment, fast local delivery.`
    : `Find ${categoryName.toLowerCase()} vendors in ${stateName}, Nigeria on MakeItSell — Nigeria's marketplace with secure escrow payment.`

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
    ...(products.length === 0 ? { robots: { index: false, follow: true } } : {}),
  }
}

export default async function BuyCategoryLocationPage({ params }: { params: Promise<Params> }) {
  const resolved = await params
  const data = await loadPageData(resolved)
  if (!data) notFound()

  const { categoryName, stateName, products, vendorCount, otherStates } = data
  const ratings = await getProductRatings(products.map((p: any) => String(p._id)))

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: categoryName, item: `${SITE_URL}/category/${resolved.category}` },
      { "@type": "ListItem", position: 3, name: stateName, item: `${SITE_URL}/buy/${resolved.category}/${resolved.location}` },
    ],
  }

  const itemListJsonLd = products.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: products.map((p: any, idx: number) => {
      const rating = ratings.get(String(p._id))
      const productUrl = `${SITE_URL}/products/${String(p._id)}`
      return {
        "@type": "ListItem",
        position: idx + 1,
        item: {
          "@type": "Product",
          name: p.name || p.title || categoryName,
          image: optimizedImageUrl(p.images?.[0], { width: 800 }),
          url: productUrl,
          ...(p.vendorName ? { brand: { "@type": "Brand", name: p.vendorName } } : {}),
          offers: {
            "@type": "Offer",
            url: productUrl,
            priceCurrency: "NGN",
            price: Number(p.price || 0),
            availability: Number(p.stock || 0) > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
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
            <Link href={`/category/${resolved.category}`} className="hover:text-accent">{categoryName}</Link>
            <span className="mx-2">/</span>
            <span>{stateName}</span>
          </nav>

          <h1 className="text-3xl font-bold mb-2">Buy {categoryName} in {stateName}</h1>
          <p className="text-muted-foreground max-w-2xl mb-8">
            {products.length > 0
              ? `Browse ${products.length}+ ${categoryName.toLowerCase()} listings from ${vendorCount} verified ${vendorCount === 1 ? 'vendor' : 'vendors'} based in ${stateName}. Every order is protected by escrow — your payment is only released once you confirm delivery.`
              : `We don't have ${categoryName.toLowerCase()} vendors based in ${stateName} listed yet. Check the options below, or browse all ${categoryName.toLowerCase()} across Nigeria.`}
          </p>

          {products.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-10">
              {products.map((p: any) => (
                <Link
                  key={String(p._id)}
                  href={`/products/${String(p._id)}`}
                  className="group block rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow bg-card"
                >
                  <div className="aspect-square bg-muted relative overflow-hidden">
                    <img
                      src={optimizedImageUrl(p.images?.[0], { width: 400 })}
                      alt={p.name || p.title || categoryName}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium truncate">{p.name || p.title}</p>
                    <p className="text-accent font-bold text-sm mt-1">₦{Number(p.price || 0).toLocaleString('en-NG')}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-10 text-center mb-10">
              <p className="text-muted-foreground mb-4">No listings here yet.</p>
              <Link href={`/category/${resolved.category}`} className="text-accent font-medium underline">
                Browse all {categoryName} across Nigeria →
              </Link>
            </div>
          )}

          {otherStates.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-3">Shop {categoryName} in Other Cities</h2>
              <div className="flex flex-wrap gap-2">
                {otherStates.map((state) => (
                  <Link
                    key={state}
                    href={`/buy/${resolved.category}/${state.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                    className="text-sm px-3 py-1.5 rounded-full border border-border hover:border-accent hover:text-accent transition-colors"
                  >
                    {categoryName} in {state}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="text-center">
            <Link href="/categories" className="text-sm text-muted-foreground hover:text-accent underline">
              Browse all categories →
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
