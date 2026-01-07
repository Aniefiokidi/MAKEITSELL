// Mock products for each store with real images and detailed content

export const mockStoreProducts = {
  "tech-empire": [
    {
      id: "te-001",
      title: "iPhone 15 Pro Max 256GB",
      description: "Latest iPhone with titanium design, advanced camera system, and A17 Pro chip for professional photography and gaming.",
      price: 649000,
      originalPrice: 749000,
      category: "Smartphones",
      images: [
        "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&h=800&fit=crop",
        "https://images.unsplash.com/photo-1695048020285-60708a3fdc5c?w=800&h=800&fit=crop"
      ],
      stock: 15,
      rating: 4.8,
      reviews: 234,
      tags: ["iPhone", "Apple", "Smartphone", "Premium"],
      specifications: {
        "Display": "6.7-inch Super Retina XDR",
        "Chip": "A17 Pro",
        "Storage": "256GB",
        "Camera": "48MP Main, 12MP Ultra Wide, 12MP Telephoto"
      }
    },
    {
      id: "te-002", 
      title: "MacBook Air M2 13-inch",
      description: "Ultra-thin and light laptop with M2 chip, all-day battery life, and stunning Liquid Retina display.",
      price: 899000,
      category: "Laptops",
      images: [
        "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&h=800&fit=crop",
        "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=800&h=800&fit=crop"
      ],
      stock: 8,
      rating: 4.9,
      reviews: 156,
      tags: ["MacBook", "Apple", "Laptop", "M2"]
    },
    {
      id: "te-003",
      title: "Samsung Galaxy Tab S9",
      description: "Premium Android tablet with S Pen included, perfect for productivity and creative work.",
      price: 485000,
      category: "Tablets", 
      images: [
        "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&h=800&fit=crop"
      ],
      stock: 12,
      rating: 4.7,
      reviews: 89
    }
  ],
  
  "fashion-forward": [
    {
      id: "ff-001",
      title: "Designer Cotton Blend Dress",
      description: "Elegant midi dress perfect for office wear or special occasions. Made from premium cotton blend fabric.",
      price: 35000,
      originalPrice: 45000,
      category: "Dresses",
      images: [
        "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&h=800&fit=crop",
        "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800&h=800&fit=crop"
      ],
      stock: 25,
      rating: 4.6,
      reviews: 78,
      tags: ["Dress", "Women", "Office Wear", "Designer"],
      sizes: ["S", "M", "L", "XL"],
      colors: ["Black", "Navy", "Wine", "Emerald"]
    },
    {
      id: "ff-002",
      title: "Premium Leather Handbag",
      description: "Genuine leather handbag with multiple compartments, perfect for daily use or business meetings.",
      price: 65000,
      category: "Bags",
      images: [
        "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&h=800&fit=crop"
      ],
      stock: 18,
      rating: 4.8,
      reviews: 134
    }
  ],

  "home-haven": [
    {
      id: "hh-001",
      title: "Modern 3-Seater Sofa",
      description: "Comfortable modern sofa with premium upholstery, perfect for living rooms and family areas.",
      price: 285000,
      category: "Furniture",
      images: [
        "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&h=800&fit=crop",
        "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=800&fit=crop"
      ],
      stock: 5,
      rating: 4.7,
      reviews: 67,
      colors: ["Gray", "Navy", "Beige", "Charcoal"]
    },
    {
      id: "hh-002",
      title: "Solid Wood Dining Table",
      description: "Handcrafted solid wood dining table that seats 6 people comfortably. Perfect for family meals.",
      price: 175000,
      category: "Dining",
      images: [
        "https://images.unsplash.com/photo-1449247709967-d4461a6a6103?w=800&h=800&fit=crop"
      ],
      stock: 3,
      rating: 4.9,
      reviews: 45
    }
  ],

  "beauty-bliss": [
    {
      id: "bb-001",
      title: "Anti-Aging Skincare Set",
      description: "Complete 4-step anti-aging routine with vitamin C serum, retinol cream, and SPF moisturizer.",
      price: 45000,
      originalPrice: 65000,
      category: "Skincare",
      images: [
        "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&h=800&fit=crop",
        "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=800&h=800&fit=crop"
      ],
      stock: 34,
      rating: 4.8,
      reviews: 156,
      tags: ["Skincare", "Anti-aging", "Beauty", "Set"]
    },
    {
      id: "bb-002",
      title: "Professional Makeup Brush Set",
      description: "24-piece professional makeup brush set with synthetic bristles and premium wooden handles.",
      price: 28000,
      category: "Makeup",
      images: [
        "https://images.unsplash.com/photo-1512207736890-6ffed8a84e8d?w=800&h=800&fit=crop"
      ],
      stock: 67,
      rating: 4.7,
      reviews: 89
    }
  ],

  "sports-zone": [
    {
      id: "sz-001",
      title: "Professional Basketball",
      description: "Official size and weight basketball with superior grip and bounce consistency.",
      price: 15000,
      category: "Sports Equipment",
      images: [
        "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=800&fit=crop"
      ],
      stock: 45,
      rating: 4.6,
      reviews: 78
    },
    {
      id: "sz-002",
      title: "Premium Yoga Mat",
      description: "Non-slip yoga mat with extra cushioning, perfect for all types of yoga and exercise.",
      price: 12000,
      originalPrice: 18000,
      category: "Fitness",
      images: [
        "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&h=800&fit=crop"
      ],
      stock: 89,
      rating: 4.8,
      reviews: 234
    }
  ],

  "gadget-galaxy": [
    {
      id: "gg-001",
      title: "Wireless Noise-Cancelling Headphones",
      description: "Premium over-ear headphones with active noise cancellation and 30-hour battery life.",
      price: 85000,
      originalPrice: 120000,
      category: "Audio",
      images: [
        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=800&fit=crop",
        "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&h=800&fit=crop"
      ],
      stock: 23,
      rating: 4.7,
      reviews: 167,
      colors: ["Black", "Silver", "Rose Gold"]
    },
    {
      id: "gg-002",
      title: "4K Action Camera",
      description: "Waterproof 4K action camera with image stabilization, perfect for adventure photography.",
      price: 125000,
      category: "Cameras",
      images: [
        "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&h=800&fit=crop"
      ],
      stock: 15,
      rating: 4.8,
      reviews: 95
    }
  ],

  "shoe-sanctuary": [
    {
      id: "ss-001",
      title: "Classic Leather Oxford Shoes",
      description: "Handcrafted genuine leather oxford shoes perfect for business and formal occasions.",
      price: 75000,
      category: "Men's Shoes",
      images: [
        "https://images.unsplash.com/photo-1614252369475-531eba835eb1?w=800&h=800&fit=crop",
        "https://images.unsplash.com/photo-1582897085656-c636d006a246?w=800&h=800&fit=crop"
      ],
      stock: 34,
      rating: 4.9,
      reviews: 123,
      sizes: ["7", "8", "9", "10", "11", "12"],
      colors: ["Black", "Brown", "Tan"]
    },
    {
      id: "ss-002", 
      title: "Nike Air Jordan 1 Retro",
      description: "Iconic basketball sneakers with premium leather construction and classic colorway.",
      price: 95000,
      originalPrice: 125000,
      category: "Sneakers",
      images: [
        "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&h=800&fit=crop",
        "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&h=800&fit=crop"
      ],
      stock: 28,
      rating: 4.8,
      reviews: 234
    }
  ]
}

// Service listings for service providers
export const mockServiceListings = {
  "tech-support-pro": [
    {
      id: "tsp-001",
      title: "Computer Repair & Troubleshooting",
      description: "Professional computer repair service including hardware diagnostics, software installation, and virus removal.",
      price: 15000,
      category: "Computer Repair",
      images: [
        "https://images.unsplash.com/photo-1588508065123-287b28e013da?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop"
      ],
      duration: "2-4 hours",
      rating: 4.8,
      reviews: 156,
      features: ["Hardware diagnosis", "Software repair", "Data recovery", "Virus removal"]
    },
    {
      id: "tsp-002",
      title: "Network Setup & Configuration",
      description: "Complete network setup for homes and small offices including Wi-Fi optimization and security configuration.",
      price: 25000,
      category: "Network Services",
      images: [
        "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&h=600&fit=crop"
      ],
      duration: "3-6 hours",
      rating: 4.9,
      reviews: 89
    }
  ],

  "home-cleaners": [
    {
      id: "hc-001",
      title: "Deep House Cleaning",
      description: "Comprehensive deep cleaning service including all rooms, bathrooms, kitchen, and detailed surface cleaning.",
      price: 35000,
      category: "Residential Cleaning",
      images: [
        "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&h=600&fit=crop"
      ],
      duration: "4-6 hours",
      rating: 4.9,
      reviews: 234,
      includes: ["All rooms", "Kitchen deep clean", "Bathroom sanitization", "Floor mopping"]
    },
    {
      id: "hc-002",
      title: "Office Cleaning Service",
      description: "Professional office cleaning including workstations, common areas, and restroom maintenance.",
      price: 45000,
      category: "Commercial Cleaning",
      images: [
        "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=800&h=600&fit=crop"
      ],
      duration: "3-5 hours",
      rating: 4.8,
      reviews: 167
    }
  ],

  "beauty-salon": [
    {
      id: "bs-001",
      title: "Premium Hair Styling Package",
      description: "Complete hair makeover including wash, cut, styling, and treatment with premium products.",
      price: 25000,
      originalPrice: 35000,
      category: "Hair Services",
      images: [
        "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1522336572468-97b06e8ef143?w=800&h=600&fit=crop"
      ],
      duration: "2-3 hours",
      rating: 4.8,
      reviews: 189,
      includes: ["Consultation", "Hair wash", "Cut & style", "Treatment"]
    },
    {
      id: "bs-002",
      title: "Bridal Makeup Package",
      description: "Complete bridal makeup service including trial session, full makeup application, and touch-up kit.",
      price: 65000,
      category: "Makeup Services",
      images: [
        "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=800&h=600&fit=crop"
      ],
      duration: "3-4 hours",
      rating: 4.9,
      reviews: 145
    }
  ],

  "fitness-trainer": [
    {
      id: "ft-001",
      title: "Personal Training Session",
      description: "One-on-one personal training session with customized workout plan and nutrition guidance.",
      price: 15000,
      category: "Personal Training",
      images: [
        "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800&h=600&fit=crop"
      ],
      duration: "1 hour",
      rating: 4.9,
      reviews: 234,
      includes: ["Fitness assessment", "Custom workout", "Nutrition tips", "Progress tracking"]
    },
    {
      id: "ft-002",
      title: "Group Fitness Class",
      description: "High-energy group fitness class suitable for all fitness levels with professional instruction.",
      price: 8000,
      category: "Group Classes",
      images: [
        "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&h=600&fit=crop"
      ],
      duration: "45 minutes",
      rating: 4.7,
      reviews: 178
    }
  ],

  "photography-studio": [
    {
      id: "ps-001",
      title: "Portrait Photography Session",
      description: "Professional portrait photography session with multiple outfit changes and edited photos.",
      price: 45000,
      category: "Portrait Photography",
      images: [
        "https://images.unsplash.com/photo-1554048612-b6a482b224b1?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800&h=600&fit=crop"
      ],
      duration: "2-3 hours",
      rating: 4.9,
      reviews: 167,
      includes: ["Studio session", "Multiple looks", "20 edited photos", "Online gallery"]
    },
    {
      id: "ps-002",
      title: "Wedding Photography Package",
      description: "Complete wedding photography coverage from preparation to reception with professional editing.",
      price: 285000,
      category: "Wedding Photography",
      images: [
        "https://images.unsplash.com/photo-1519741497674-611481863552?w=800&h=600&fit=crop"
      ],
      duration: "8-10 hours",
      rating: 4.8,
      reviews: 89
    }
  ]
}

export default { mockStoreProducts, mockServiceListings }