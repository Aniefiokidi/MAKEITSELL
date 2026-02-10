import React from "react";
import { notFound } from "next/navigation";

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

export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await getProduct(params.id);
  if (!product) return notFound();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-10 px-4">
      <div className="max-w-xl w-full bg-white/80 dark:bg-gray-900 rounded-2xl shadow-lg p-6 flex flex-col items-center">
        <img
          src={product.images?.[0] || "/placeholder.png"}
          alt={product.title || product.name || "Product"}
          className="w-48 h-48 object-cover rounded-xl mb-4 border-2 border-accent"
        />
        <h1 className="text-2xl font-bold mb-2 text-center">{product.title || product.name}</h1>
        <div className="mb-2 text-accent font-bold text-xl">₦{product.price?.toLocaleString?.() || product.price}</div>
        <div className="mb-2 text-sm text-muted-foreground text-center">{product.description}</div>
        <div className="mb-2 flex flex-wrap gap-2 justify-center">
          <span className="bg-accent/10 text-accent px-2 py-1 rounded text-xs">{product.category}</span>
          {product.featured && <span className="bg-yellow-200 text-yellow-800 px-2 py-1 rounded text-xs">Featured</span>}
          {product.stock === 0 && <span className="bg-gray-200 text-gray-800 px-2 py-1 rounded text-xs">Out of Stock</span>}
        </div>
        <div className="mb-4 text-xs text-muted-foreground">Sold by: {product.vendorName || 'Unknown Vendor'}</div>
        <button
          className="w-full bg-accent text-white font-bold py-2 px-4 rounded-lg hover:bg-accent/90 transition disabled:opacity-60"
          disabled={product.stock === 0 || product.status !== 'active'}
        >
          Add to Cart
        </button>
      </div>
    </div>
  );
}
