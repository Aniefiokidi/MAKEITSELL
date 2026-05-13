"use client"

import { useWishlist } from '@/contexts/WishlistContext'
import { useCart } from '@/contexts/CartContext'
import { useAuth } from '@/contexts/AuthContext'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { Button } from '@/components/ui/button'
import { Heart, ShoppingCart, Trash2, ArrowLeft } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function WishlistPage() {
  const { user } = useAuth()
  const { items, toggle } = useWishlist()
  const { addItem } = useCart()
  const router = useRouter()

  useEffect(() => {
    if (!user) router.push('/login')
  }, [user])

  const handleAddToCart = (item: typeof items[0]) => {
    addItem({
      productId: item.productId,
      title: item.title,
      price: item.price,
      image: item.image,
      vendorId: item.vendorId,
      vendorName: '',
      maxStock: 100,
    })
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <Header />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/stores"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold">Wishlist</h1>
            <p className="text-xs text-muted-foreground">{items.length} saved {items.length === 1 ? 'item' : 'items'}</p>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-24 space-y-4">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
              <Heart className="h-7 w-7 text-accent" />
            </div>
            <p className="font-semibold text-lg">Your wishlist is empty</p>
            <p className="text-muted-foreground text-sm">Save products you love and come back to them anytime.</p>
            <Button asChild><Link href="/stores">Browse Stores</Link></Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(item => (
              <div key={item.productId} className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
                <div className="relative h-44 w-full bg-muted">
                  <Image
                    src={item.image || '/placeholder.svg'}
                    alt={item.title}
                    fill
                    className="object-cover"
                  />
                  <button
                    onClick={() => toggle(item)}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow"
                  >
                    <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                  </button>
                </div>
                <div className="p-3 space-y-3">
                  <div>
                    <p className="font-semibold text-sm line-clamp-2 leading-snug">{item.title}</p>
                    <p className="text-accent font-bold mt-1">₦{item.price?.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleAddToCart(item)}
                    >
                      <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
                      Add to Cart
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive hover:text-white"
                      onClick={() => toggle(item)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
