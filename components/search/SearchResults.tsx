"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, ShoppingCart, MapPin, Users, Clock, Store as StoreIcon } from "lucide-react";
import React from "react";

const getCategoryIcon = (category: string) => {
  // ...copy from services page if needed...
  return <StoreIcon className="h-5 w-5 text-white" />;
};

export default function SearchResults({ query }: { query: string }) {
  const [products, setProducts] = React.useState<any[]>([]);
  const [services, setServices] = React.useState<any[]>([]);
  const [stores, setStores] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!query) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/database/products?limit=12&search=${encodeURIComponent(query)}`).then(r => r.json()),
      fetch(`/api/database/services?limit=12&search=${encodeURIComponent(query)}`).then(r => r.json()),
      fetch(`/api/database/stores?limit=12&search=${encodeURIComponent(query)}`).then(r => r.json()),
    ]).then(([prod, serv, stor]) => {
      setProducts(prod.data || []);
      setServices(serv.data || []);
      setStores(stor.data || []);
      setLoading(false);
    });
  }, [query]);

  if (!query) return null;
  if (loading) return <div className="py-10 text-center text-muted-foreground">Loading results...</div>;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-10">
      {/* Products */}
      {products.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Products</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {products.map((product: any) => (
              <Card key={product.id} className="border-0 shadow-md overflow-hidden relative h-[280px] hover:shadow-xl transition-all duration-500 hover:-translate-y-2 rounded-2xl sm:rounded-3xl active:scale-95 md:active:scale-100 cursor-pointer group">
                <div className="group absolute inset-0 overflow-hidden">
                  <Image src={product.images?.[0] || "/placeholder.png"} alt={product.title || product.name || "Product image"} fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                  {product.stock === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                      <div className="bg-red-600 text-white px-4 py-1 transform -rotate-45 font-bold text-xs shadow-lg">OUT OF STOCK</div>
                    </div>
                  )}
                  <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                    {product.featured && (
                      <Badge className="bg-yellow-500 text-black font-semibold text-[10px] px-1.5 py-0.5">Featured</Badge>
                    )}
                    {(product.stock ?? 0) < 10 && (product.stock ?? 0) > 0 && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">Only {product.stock} left</Badge>
                    )}
                    {product.stock === 0 && (
                      <Badge variant="secondary" className="bg-gray-600 text-[10px] px-1.5 py-0.5">Out of Stock</Badge>
                    )}
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-2 backdrop-blur-xl bg-accent/10 border-t border-white/30 rounded-t-2xl z-30 space-y-1 gap-1">
                  <Badge variant="outline" className="inline-flex w-full text-[10px] font-semibold px-2 py-1 rounded-full border-white/40 shadow bg-accent text-white hover:opacity-90 transition min-h-5 items-center justify-center text-center leading-tight">
                    <span className="line-clamp-2">{product.title || product.name}</span>
                  </Badge>
                  <div className="flex items-center justify-between gap-1">
                    <Badge variant="outline" className="text-[9px] backdrop-blur-sm border-white/50 px-1 py-0 text-white bg-accent">{product.category}</Badge>
                    <Badge variant="outline" className="text-[9px] font-semibold px-2 py-1 rounded-full border-white/40 backdrop-blur-sm bg-white/70 text-accent">₦{product.price?.toLocaleString?.() || product.price}</Badge>
                  </div>
                  {product.hasSizeOptions && product.sizes && product.sizes.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {product.sizes.slice(0, 5).map((size: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-[8px] px-1 py-0 border-white/40 bg-white/60 text-accent">{size}</Badge>
                      ))}
                    </div>
                  )}
                  <Button size="sm" className="w-full h-6 text-[10px] backdrop-blur-sm hover:scale-105 active:scale-95 transition-all hover:shadow-lg flex items-center justify-center gap-0 bg-white/20 hover:bg-white/80 text-accent">
                    <img src="/images/logo3.png" alt="Add" className="w-6 h-6 -mt-1" />
                    <span className="leading-none hidden sm:inline">Add</span>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
      {/* Services */}
      {services.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Services</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {services.map((service: any, index: number) => (
              <Card key={service.id} className="h-full hover:shadow-2xl hover:shadow-accent/40 hover:scale-[1.02] transition-all duration-300 group overflow-hidden border-none rounded-b-3xl relative">
                <div className="aspect-9/16 relative overflow-hidden rounded-b-3xl">
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
                  <div className="absolute inset-0 bg-linear-to-b rounded-b-3xl from-black/20 via-transparent via-50% to-black/90" />
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md border-3 border-white overflow-hidden shadow-2xl ring-3 ring-white/30 group-hover:ring-white/50 transition-all group-hover:scale-110 flex items-center justify-center">
                      {getCategoryIcon(service.category)}
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 z-10 backdrop-blur-md bg-black/20 rounded-b-3xl border-t border-white/10 p-2">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xs sm:text-lg font-bold tracking-tight mb-0.5 text-white drop-shadow-lg truncate">{service.title}</h3>
                        {service.providerName && (
                          <div className="flex items-center gap-0.5 text-[7px] sm:text-xs font-medium text-white/90 tracking-wide mb-1">
                            <Badge variant="outline" className="w-fit text-[7px] sm:text-[10px] font-semibold py-0.5 px-1.5 sm:px-2 h-4 sm:h-5 tracking-wide border-2 border-white/40 bg-white/10 text-white backdrop-blur-sm">{service.providerName}</Badge>
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
              <Card key={store.id} className="h-full hover:shadow-2xl hover:shadow-accent/40 hover:scale-[1.02] transition-all duration-300 group overflow-hidden border-none rounded-[2.5rem] relative">
                <div className="aspect-9/16 relative overflow-hidden rounded-[2.5rem]">
                  {store.profileImage || store.featuredProduct?.image || store.productImages?.[0] || store.bannerImage ? (
                    <Image src={store.profileImage || store.featuredProduct?.image || store.productImages?.[0] || store.bannerImage} alt={store.name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="flex items-center justify-center h-full bg-linear-to-br from-accent/90 via-orange-500/90 to-red-600/90">
                      <StoreIcon className="h-20 w-20 text-white drop-shadow-lg animate-pulse" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-linear-to-b from-black/20 via-transparent via-50% to-black/90" />
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
                    <div className="w-16 h-16 rounded-full bg-white border-4 border-white overflow-hidden shadow-2xl ring-4 ring-white/30 group-hover:ring-white/50 transition-all group-hover:scale-110">
                      {store.storeImage || store.logoImage ? (
                        <Image src={store.storeImage || store.logoImage} alt={`${store.name} logo`} width={64} height={64} className="object-cover" />
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
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
      {products.length === 0 && services.length === 0 && stores.length === 0 && (
        <div className="text-center text-muted-foreground py-10">No results found for "{query}".</div>
      )}
    </div>
  );
}
