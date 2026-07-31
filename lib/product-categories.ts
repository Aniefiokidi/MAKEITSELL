// Shared goods-category list — the canonical source is (was) the inline `categories`
// array in app/categories/page.tsx. Extracted here so non-React consumers (the WhatsApp
// bot's category menu) can use the same slug/name/description set without pulling in
// lucide-react icons or Tailwind color classes, which only make sense in that page's UI.
export interface ProductCategory {
  slug: string
  name: string
  description: string
}

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  { slug: "electronics", name: "Electronics", description: "Latest gadgets, smartphones, computers and more" },
  { slug: "fashion", name: "Fashion", description: "Clothing, shoes, bags and accessories" },
  { slug: "home", name: "Home & Garden", description: "Furniture, decor, kitchen and garden items" },
  { slug: "accessories", name: "Accessories", description: "Watches, jewelry, bags and more" },
  { slug: "sports", name: "Sports & Fitness", description: "Exercise equipment, sportswear and outdoor gear" },
  { slug: "audio", name: "Audio & Music", description: "Headphones, speakers, instruments" },
  { slug: "photography", name: "Photography", description: "Cameras, lenses, lighting equipment" },
  { slug: "books", name: "Books & Media", description: "Books, magazines, digital content" },
  { slug: "gaming", name: "Gaming", description: "Video games, consoles, accessories" },
  { slug: "automotive", name: "Automotive", description: "Car accessories, tools, parts" },
  { slug: "home-services", name: "Home Services", description: "Repairs, maintenance, installation and cleaning" },
  { slug: "logistics-delivery", name: "Logistics & Delivery", description: "Moving, delivery and transport services" },
  { slug: "health-wellness", name: "Health & Wellness", description: "Healthcare, wellness and personal care" },
  { slug: "business-services", name: "Business Services", description: "Consulting, accounting and virtual support" },
  { slug: "events", name: "Events & Catering", description: "Event planning, catering and coordination" },
  { slug: "pet-care", name: "Pet Care", description: "Pet products, grooming and sitter services" },
  { slug: "groceries", name: "Groceries", description: "Fresh produce, pantry and daily essentials" },
  { slug: "pharmacy", name: "Pharmacy", description: "Medicines, wellness and health supplies" },
  { slug: "furniture", name: "Furniture", description: "Home and office furniture stores" },
  { slug: "toys-baby", name: "Toys & Baby", description: "Kids essentials, toys and baby products" },
]
