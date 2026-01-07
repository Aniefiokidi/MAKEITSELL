/**
 * Utility functions for handling product images
 */

// Unsplash image optimization
export const getOptimizedImageUrl = (
  unsplashUrl: string, 
  width: number = 400, 
  height: number = 400,
  quality: number = 80
): string => {
  if (unsplashUrl.includes('unsplash.com')) {
    // Extract the photo ID from Unsplash URL
    const photoId = unsplashUrl.match(/photo-([a-zA-Z0-9_-]+)/)?.[1]
    if (photoId) {
      return `https://images.unsplash.com/photo-${photoId}?w=${width}&h=${height}&fit=crop&crop=center&auto=format&q=${quality}`
    }
  }
  
  // Return original URL if not Unsplash
  return unsplashUrl
}

// Fallback image for broken links
export const getImageWithFallback = (imageUrl: string): string => {
  return imageUrl || '/placeholder.svg'
}

// Product image collections
export const productImageUrls = {
  // Electronics
  iphone: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=400&h=400&fit=crop&crop=center',
  samsung: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400&h=400&fit=crop&crop=center',
  macbook: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=400&fit=crop&crop=center',
  headphones: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop&crop=center',
  appleWatch: 'https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=400&h=400&fit=crop&crop=center',
  camera: 'https://images.unsplash.com/photo-1606983340126-99ab4feaa64a?w=400&h=400&fit=crop&crop=center',
  keyboard: 'https://images.unsplash.com/photo-1541140532154-b024d705b90a?w=400&h=400&fit=crop&crop=center',
  earbuds: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&h=400&fit=crop&crop=center',

  // Fashion
  jordans: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&h=400&fit=crop&crop=center',
  adidas: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop&crop=center',
  sunglasses: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=400&h=400&fit=crop&crop=center',

  // Home & Furniture
  chair: 'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=400&h=400&fit=crop&crop=center',

  // Generic categories
  electronics: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400&h=400&fit=crop&crop=center',
  fashion: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=400&h=400&fit=crop&crop=center',
  home: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=400&fit=crop&crop=center',
  sports: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop&crop=center',
  beauty: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&h=400&fit=crop&crop=center'
}

export default {
  getOptimizedImageUrl,
  getImageWithFallback,
  productImageUrls
}