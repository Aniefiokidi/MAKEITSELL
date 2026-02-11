"use client"

import React, { useState } from "react";
import { notFound } from "next/navigation";
import { useEffect } from "react";

async function getProduct(id: string) {
  if (!id) return null;
  // Try to use absolute URL if available, else fallback to relative
  let url = '';
  if (typeof window === 'undefined') {
    // On server, use process.env.NEXT_PUBLIC_BASE_URL or fallback to https://www.makeitsell.org
    const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.makeitsell.org';
    url = `${base}/api/database/products?id=${id}`;
  } else {
    url = `/api/database/products?id=${id}`;
  }
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();
  if (!data.success || !data.data || !data.data.length) return null;
  return data.data[0];
}

export default function ProductPage({ params }: { params: { id: string } }) {
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [mainImage, setMainImage] = useState<string>("");

  useEffect(() => {
    async function fetchProduct() {
      const prod = await getProduct(params.id);
      if (prod) {
        setProduct(prod);
        setMainImage(prod.images?.[0] || "/placeholder.png");
      }
      setLoading(false);
    }
    fetchProduct();
  }, [params.id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!product) return notFound();

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    if (product.colorImages && product.colorImages[color]) {
      setMainImage(product.colorImages[color]);
    }
  };

  const displayImage = mainImage || product.images?.[0] || "/placeholder.png";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-10 px-4">
      <div className="max-w-2xl w-full bg-white/80 dark:bg-gray-900 rounded-2xl shadow-lg p-6">
        <div className="flex flex-col md:grid md:grid-cols-2 gap-6">
          {/* Product Image */}
          <div className="flex flex-col items-center">
            <img
              src={displayImage}
              alt={product.title || product.name || "Product"}
              className="w-full max-w-sm h-auto object-cover rounded-xl mb-4 border-2 border-accent"
            />
            {/* Thumbnails */}
            {(product.images || []).length > 1 && (
              <div className="flex gap-2 flex-wrap justify-center">
                {(product.images || []).map((img: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => setMainImage(img)}
                    className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                      mainImage === img ? "border-accent ring-2 ring-accent/30" : "border-slate-200 hover:border-accent/50"
                    }`}
                  >
                    <img src={img} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Details */}
          <div className="flex flex-col">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">{product.title || product.name}</h1>
            <div className="mb-4 text-accent font-bold text-2xl">₦{product.price?.toLocaleString?.() || product.price}</div>
            
            {/* Stock Status */}
            <div className={`mb-4 rounded-lg p-3 flex items-center gap-2 text-sm ${
              (product.stock || 0) > 10 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                : (product.stock || 0) > 0
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                (product.stock || 0) > 10 
                  ? 'bg-emerald-500' 
                  : (product.stock || 0) > 0
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`}></div>
              <span className="font-semibold">
                {(product.stock || 0) > 10 
                  ? `In Stock (${product.stock}+ available)` 
                  : (product.stock || 0) > 0
                  ? `Only ${product.stock} left!`
                  : 'Out of Stock'}
              </span>
            </div>

            {/* Color Options */}
            {product.hasColorOptions && product.colors && product.colors.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold text-sm mb-2">Select Color</h3>
                <div className="flex gap-2 flex-wrap">
                  {product.colors.map((color: string) => (
                    <button
                      key={color}
                      onClick={() => handleColorSelect(color)}
                      className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-all flex items-center gap-2 ${
                        selectedColor === color
                          ? "bg-accent text-white border-accent"
                          : "bg-white text-slate-700 border-slate-300 hover:border-accent hover:bg-accent/10"
                      }`}
                    >
                      <div 
                        className="w-4 h-4 rounded-full border border-gray-300" 
                        style={{ backgroundColor: color.toLowerCase().replace(/ /g, '') }}
                      />
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Size Options */}
            {product.hasSizeOptions && product.sizes && product.sizes.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold text-sm mb-2">Select Size</h3>
                <div className="flex gap-2 flex-wrap">
                  {product.sizes.map((size: string) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-all ${
                        selectedSize === size
                          ? "bg-accent text-white border-accent"
                          : "bg-white text-slate-700 border-slate-300 hover:border-accent hover:bg-accent/10"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4 text-sm text-muted-foreground">{product.description}</div>
            
            <div className="mb-4 flex flex-wrap gap-2">
              <span className="bg-accent/10 text-accent px-2 py-1 rounded text-xs">{product.category}</span>
              {product.featured && <span className="bg-yellow-200 text-yellow-800 px-2 py-1 rounded text-xs">Featured</span>}
            </div>
            
            <div className="mb-4 text-xs text-muted-foreground">Sold by: {product.vendorName || 'Unknown Vendor'}</div>
            
            <button
              className="w-full bg-accent text-white font-bold py-3 px-4 rounded-lg hover:bg-accent/90 transition disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={product.stock === 0 || product.status !== 'active'}
            >
              {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
