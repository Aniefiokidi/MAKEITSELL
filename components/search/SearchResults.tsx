"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { useNotification } from "@/contexts/NotificationContext";
import { MapPin, Users, Clock, Store as StoreIcon, ExternalLink } from "lucide-react";
import React from "react";

const getCategoryIcon = (category: string) => {
  // ...copy from services page if needed...
  return <StoreIcon className="h-5 w-5 text-white" />;
};

export default function SearchResults({ query }: { query: string }) {
  const router = useRouter();
  const { addItem } = useCart();
  const notification = useNotification();
  const [products, setProducts] = React.useState<any[]>([]);
  const [services, setServices] = React.useState<any[]>([]);
  const [stores, setStores] = React.useState<any[]>([]);
  const [recommendedProducts, setRecommendedProducts] = React.useState<any[]>([]);
  const [didYouMean, setDidYouMean] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const isPdfAsset = React.useCallback((value?: string) => {
    if (!value) return false;
    return /\.pdf(\?|#|$)/i.test(value);
  }, []);

  const levenshteinDistance = React.useCallback((a: string, b: string) => {
    const source = a.toLowerCase();
    const target = b.toLowerCase();
    const matrix: number[][] = Array.from({ length: source.length + 1 }, () => Array(target.length + 1).fill(0));

    for (let i = 0; i <= source.length; i += 1) matrix[i][0] = i;
    for (let j = 0; j <= target.length; j += 1) matrix[0][j] = j;

    for (let i = 1; i <= source.length; i += 1) {
      for (let j = 1; j <= target.length; j += 1) {
        const cost = source[i - 1] === target[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    return matrix[source.length][target.length];
  }, []);

  const buildTokens = React.useCallback((searchQuery: string) => {
    return searchQuery
      .toLowerCase()
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 1);
  }, []);

  const getRecommendationScore = React.useCallback((product: any, tokens: string[]) => {
    const title = String(product?.title || product?.name || "").toLowerCase();
    const description = String(product?.description || "").toLowerCase();
    const category = String(product?.category || "").toLowerCase();

    let score = 0;
    for (const token of tokens) {
      if (title.includes(token)) score += 3;
      if (category.includes(token)) score += 2;
      if (description.includes(token)) score += 1;
    }

    const sales = Number(product?.sales || 0);
    const rating = Number(product?.rating || 0);
    const reviewCount = Number(product?.reviewCount || product?.reviews || 0);
    const stock = Number(product?.stock || 0);

    const popularityScore =
      Math.min(sales, 200) / 12 +
      Math.min(reviewCount, 100) / 10 +
      Math.max(0, Math.min(rating, 5)) * 2 +
      (stock > 0 ? 1.5 : -1.5) +
      (product?.featured ? 2.5 : 0);

    score += popularityScore;
    return score;
  }, []);

  const handleAddToCart = React.useCallback((product: any) => {
    if (!product?.id) return;

    addItem({
      id: product.id,
      productId: product.id,
      title: product.title || product.name || "Product",
      price: Number(product.price || 0),
      image: product.images?.[0] || "/placeholder.png",
      vendorId: product.vendorId,
      vendorName: product.vendorName || "Unknown Vendor",
      maxStock: product.stock || 100,
    });

    notification.success(
      "Product added to cart",
      product.title || product.name || "Added to cart",
      2500
    );
  }, [addItem, notification]);

  React.useEffect(() => {
    if (!query) {
      setProducts([]);
      setServices([]);
      setStores([]);
      setRecommendedProducts([]);
      setDidYouMean(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    Promise.all([
      fetch(`/api/database/products?limit=12&search=${encodeURIComponent(query)}`).then(r => r.json()),
      fetch(`/api/database/services?limit=12&search=${encodeURIComponent(query)}`).then(r => r.json()),
      fetch(`/api/database/stores?limit=12&search=${encodeURIComponent(query)}`).then(r => r.json()),
    ])
      .then(async ([prod, serv, stor]) => {
        const exactProducts = Array.isArray(prod?.data) ? prod.data : [];
        setProducts(exactProducts);
        setServices(Array.isArray(serv?.data) ? serv.data : []);
        setStores(Array.isArray(stor?.data) ? stor.data : []);

        if (exactProducts.length === 0) {
          const recommendationResponse = await fetch(`/api/database/products?limit=60`);
          const recommendationPayload = await recommendationResponse.json();
          const allProducts = Array.isArray(recommendationPayload?.data) ? recommendationPayload.data : [];
          const tokens = buildTokens(query);

          const candidateTerms: string[] = Array.from(
            new Set(
              allProducts
                .flatMap((product: any) => [product?.title, product?.name, product?.category, product?.subcategory])
                .filter(Boolean)
                .map((term: any) => String(term).trim())
                .filter((term: string) => term.length > 2)
            )
          );

          let closestSuggestion: string | null = null;
          let closestDistance = Number.POSITIVE_INFINITY;
          for (const term of candidateTerms) {
            const distance = levenshteinDistance(query, term);
            if (distance < closestDistance) {
              closestDistance = distance;
              closestSuggestion = term;
            }
          }

          if (
            closestSuggestion &&
            closestSuggestion.toLowerCase() !== query.toLowerCase() &&
            closestDistance <= Math.max(2, Math.floor(query.length * 0.35))
          ) {
            setDidYouMean(closestSuggestion);
          } else {
            setDidYouMean(null);
          }

          const scored = allProducts
            .map((product: any) => ({
              product,
              score: getRecommendationScore(product, tokens),
            }))
            .filter((entry: any) => entry.score > 0)
            .sort((a: any, b: any) => b.score - a.score)
            .slice(0, 8)
            .map((entry: any) => entry.product);

          if (scored.length > 0) {
            setRecommendedProducts(scored);
          } else {
            const fallback = allProducts
              .filter((product: any) => Boolean(product?.featured))
              .slice(0, 8);

            setRecommendedProducts(fallback.length > 0 ? fallback : allProducts.slice(0, 8));
          }
        } else {
          setRecommendedProducts([]);
          setDidYouMean(null);
        }
      })
      .catch(() => {
        setProducts([]);
        setServices([]);
        setStores([]);
        setRecommendedProducts([]);
        setDidYouMean(null);
      })
      .finally(() => setLoading(false));
  }, [buildTokens, getRecommendationScore, levenshteinDistance, query]);

  if (!query) return null;
  if (loading) return <div className="py-10 text-center text-muted-foreground">Loading results...</div>;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-10">
      {/* Products */}
      <div>
        <h2 className="text-xl font-bold mb-4">Products</h2>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card/30 p-4 sm:p-6 text-center">
            <p className="text-base sm:text-lg font-semibold text-foreground">
              No exact product matches found for "{query}".
            </p>
            {didYouMean && (
              <p className="text-sm mt-1">
                Did you mean{" "}
                <button
                  type="button"
                  className="text-accent font-semibold underline underline-offset-4"
                  onClick={() => router.push(`/search?query=${encodeURIComponent(didYouMean)}`)}
                >
                  {didYouMean}
                </button>
                ?
              </p>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              Try these similar products instead.
            </p>
          </div>
        ) : null}

        {products.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">
            {products.map((product: any) => (
              <Card
                key={product.id}
                onClick={() => router.push(`/products/${product.id}`)}
                className="border-0 shadow-md overflow-hidden relative h-[280px] sm:h-[350px] md:h-[380px] hover:shadow-xl transition-all duration-500 hover:-translate-y-2 rounded-2xl sm:rounded-3xl active:scale-95 md:active:scale-100 cursor-pointer group"
              >
                <div className="group absolute inset-0 overflow-hidden">
                  <Image
                    src={product.images?.[0] || "/placeholder.png"}
                    alt={product.title || product.name || "Product image"}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  {product.stock === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                      <div className="bg-red-600 text-white px-4 sm:px-8 py-1 sm:py-2 transform -rotate-45 font-bold text-xs sm:text-sm shadow-lg">OUT OF STOCK</div>
                    </div>
                  )}
                  <div className="absolute top-2 sm:top-3 left-2 sm:left-3 flex flex-col gap-1 z-10">
                    {product.featured && (
                      <Badge className="bg-yellow-500 text-black font-semibold text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">Featured</Badge>
                    )}
                    {(product.stock ?? 0) < 10 && (product.stock ?? 0) > 0 && (
                      <Badge variant="destructive" className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">Only {product.stock} left</Badge>
                    )}
                    {product.stock === 0 && (
                      <Badge variant="secondary" className="bg-gray-600 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">Out of Stock</Badge>
                    )}
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-2.5 md:p-3 backdrop-blur-xl bg-accent/10 border-t border-white/30 rounded-t-2xl sm:rounded-t-3xl z-30 space-y-1 gap-1 sm:gap-2">
                  <Badge variant="outline" className="inline-flex w-full text-[10px] sm:text-xs md:text-sm font-semibold px-2 sm:px-2.5 py-1 rounded-full border-white/40 shadow bg-accent text-white hover:opacity-90 transition min-h-5 sm:min-h-6 items-center justify-center text-center leading-tight">
                    <span className="line-clamp-2 sm:line-clamp-1">{product.title || product.name}</span>
                  </Badge>
                  <div className="flex items-center justify-between gap-1 sm:gap-2">
                    <Badge variant="outline" className="text-[9px] sm:text-[10px] md:text-xs backdrop-blur-sm border-white/50 px-1 sm:px-1.5 py-0 text-white bg-accent">{product.category}</Badge>
                    <Badge variant="outline" className="text-[9px] sm:text-[10px] md:text-xs font-semibold px-2 sm:px-2.5 py-1 rounded-full border-white/40 backdrop-blur-sm bg-white/70 text-accent">₦{product.price?.toLocaleString?.() || product.price}</Badge>
                  </div>
                  {product.hasSizeOptions && product.sizes && product.sizes.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {product.sizes.slice(0, 5).map((size: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-[8px] sm:text-[9px] md:text-[10px] px-1 sm:px-1.5 py-0 border-white/40 bg-white/60 text-accent">{size}</Badge>
                      ))}
                    </div>
                  )}
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddToCart(product);
                    }}
                    disabled={product.stock === 0}
                    className="w-full h-6 sm:h-7 md:h-8 text-[10px] sm:text-xs md:text-xs backdrop-blur-sm hover:scale-105 active:scale-95 transition-all hover:shadow-lg flex items-center justify-center gap-0 bg-white/50 hover:bg-white text-black"
                  >
                    <img src="/images/logo3.png" alt="Add" className="w-6 sm:w-7 md:w-8 h-6 sm:h-7 md:h-8 -mt-1 sm:-mt-2" />
                    <span className="leading-none text-accent">Add to cart</span>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {products.length === 0 && recommendedProducts.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Recommended Similar Products</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {recommendedProducts.map((product: any) => (
                <Card
                  key={`recommended-${product.id}`}
                  onClick={() => router.push(`/products/${product.id}`)}
                  className="border border-border/60 shadow-sm overflow-hidden relative h-[260px] hover:shadow-lg transition-all duration-300 cursor-pointer group"
                >
                  <div className="absolute inset-0">
                    <Image src={product.images?.[0] || "/placeholder.png"} alt={product.title || product.name || "Product image"} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                  <div className="absolute inset-0 bg-linear-to-b from-transparent to-black/70" />
                  <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
                    <p className="text-xs font-semibold line-clamp-2">{product.title || product.name}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[11px] font-semibold">₦{product.price?.toLocaleString?.() || product.price}</span>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToCart(product);
                        }}
                        disabled={product.stock === 0}
                        className="h-6 text-[10px] bg-white/20 hover:bg-white/30 text-white"
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Services */}
      {services.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Services</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {services.map((service: any, index: number) => (
              <Card key={service.id} className="h-full hover:shadow-2xl hover:shadow-accent/40 hover:scale-[1.02] transition-all duration-300 group overflow-hidden border-none rounded-[2.5rem] relative">
                <div className="aspect-9/16 relative overflow-hidden rounded-[2.5rem]">
                  {service.images && service.images.length > 0 ? (
                    <Image src={service.images[0]} alt={service.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="flex items-center justify-center h-full bg-linear-to-br from-accent/90 via-orange-500/90 to-red-600/90">
                      <svg className="h-12 w-12 sm:h-20 sm:w-20 text-white drop-shadow-lg animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-linear-to-b from-black/20 via-transparent via-50% to-black/90" />
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md border-3 border-white overflow-hidden shadow-2xl ring-3 ring-white/30 group-hover:ring-white/50 transition-all group-hover:scale-110 flex items-center justify-center">
                      {getCategoryIcon(service.category)}
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 z-10 backdrop-blur-md bg-black/20 rounded-b-[2.5rem] border-t border-white/10 p-2">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex-1 min-w-0 min-h-[72px] sm:min-h-[86px]">
                        <h3
                          className={`font-bold tracking-tight mb-0.5 text-white drop-shadow-lg line-clamp-2 leading-tight ${
                            String(service.title || "").length > 34 ? "text-[11px] sm:text-sm" : "text-xs sm:text-lg"
                          }`}
                        >
                          {service.title}
                        </h3>
                        {service.providerName && (
                          <div className="flex items-center gap-0.5 text-[7px] sm:text-xs font-medium text-white/90 tracking-wide mb-1">
                            <Badge variant="outline" className="max-w-full text-[7px] sm:text-[10px] font-semibold py-0.5 px-1.5 sm:px-2 h-4 sm:h-5 tracking-wide border-2 border-white/40 bg-white/10 text-white backdrop-blur-sm">
                              <span className="line-clamp-1">{service.providerName}</span>
                            </Badge>
                          </div>
                        )}
                        <Badge variant="outline" className="w-fit text-[7px] sm:text-[10px] font-semibold py-0.5 px-1.5 sm:px-2 h-4 sm:h-5 tracking-wide border-2 border-white/40 bg-white/10 text-white backdrop-blur-sm">{service.category}</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
      {/* Stores */}
      {stores.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Stores</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {stores.map((store: any) => (
              (() => {
                const storeBrandingPdfUrl = [
                  store.storeImage,
                  store.logoImage,
                  store.profileImage,
                  store.bannerImage,
                  store.backgroundImage,
                ].find((value) => isPdfAsset(value))

                return (
              <Card key={store.id} className="h-full hover:shadow-2xl hover:shadow-accent/40 hover:scale-[1.02] transition-all duration-300 group overflow-hidden border-none rounded-[2.5rem] relative">
                <div className="aspect-9/16 relative overflow-hidden rounded-[2.5rem]">
                  {store.profileImage || store.featuredProduct?.image || store.productImages?.[0] || store.bannerImage ? (
                    <Image
                      src={
                        isPdfAsset(store.profileImage || store.featuredProduct?.image || store.productImages?.[0] || store.bannerImage)
                          ? "/placeholder.png"
                          : (store.profileImage || store.featuredProduct?.image || store.productImages?.[0] || store.bannerImage)
                      }
                      alt={store.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full bg-linear-to-br from-accent/90 via-orange-500/90 to-red-600/90">
                      <StoreIcon className="h-20 w-20 text-white drop-shadow-lg animate-pulse" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-linear-to-b from-black/20 via-transparent via-50% to-black/90" />
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
                    <div className="w-16 h-16 rounded-full bg-white border-4 border-white overflow-hidden shadow-2xl ring-4 ring-white/30 group-hover:ring-white/50 transition-all group-hover:scale-110">
                      {store.storeImage || store.logoImage ? (
                        <Image
                          src={isPdfAsset(store.storeImage || store.logoImage) ? "/placeholder.png" : (store.storeImage || store.logoImage)}
                          alt={`${store.name} logo`}
                          width={64}
                          height={64}
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-linear-to-br from-accent to-orange-500 flex items-center justify-center">
                          <StoreIcon className="h-8 w-8 text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 z-10 backdrop-blur-md bg-black/20 rounded-b-[2.5rem] border-t border-white/10 p-3">
                    <div className="flex items-start justify-between w-full gap-1 mb-1">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xs sm:text-base font-bold tracking-tight mb-0.5 text-white drop-shadow-lg truncate">{store.name || "Unnamed Store"}</h3>
                        <div className="flex items-center text-[8px] sm:text-xs font-medium text-white/90 tracking-wide mb-1">
                          <MapPin className="h-2.5 w-2.5 mr-0.5 shrink-0" />
                          <span className="truncate">{store.location || store.city || "Location not specified"}</span>
                        </div>
                        {store.category && (
                          <Badge variant="outline" className="w-fit text-[7px] sm:text-[10px] font-semibold py-0.5 px-1.5 sm:px-2 h-4 sm:h-5 tracking-wide border-2 border-white/40 bg-white/10 text-white backdrop-blur-sm">{store.category}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 text-[7px] sm:text-[10px] font-medium text-white/80 tracking-wide">
                      <div className="flex items-center gap-0.5">
                        <Users className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        <span className="hidden sm:inline">{store.productCount || 0} products</span>
                        <span className="sm:hidden">{store.productCount || 0}</span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        <span className="hidden sm:inline">Est. {new Date(store.createdAt || Date.now()).getFullYear()}</span>
                        <span className="sm:hidden">{new Date(store.createdAt || Date.now()).getFullYear()}</span>
                      </div>
                    </div>
                    {storeBrandingPdfUrl && (
                      <div className="mt-2">
                        <a
                          href={storeBrandingPdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[9px] sm:text-[11px] font-semibold text-white/90 hover:text-white underline underline-offset-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" />
                          View Brand PDF
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
                )
              })()
            ))}
          </div>
        </div>
      )}
      {products.length === 0 && recommendedProducts.length === 0 && services.length === 0 && stores.length === 0 && (
        <div className="text-center text-muted-foreground py-10">No results found for "{query}".</div>
      )}
    </div>
  );
}
