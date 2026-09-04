// The vendor-facing product category/subcategory taxonomy — the actual list a vendor
// picks from when creating/editing a product. NOT the same as lib/product-categories.ts,
// which is a separate, unrelated slug-based list used only for site-wide category
// browse/navigation.
//
// This used to be copy-pasted three times (app/vendor/products/new/page.tsx,
// app/vendor/products/[id]/edit/page.tsx, and app/category/[slug]/page.tsx's own
// electronicsSubcategories), and the three copies had already drifted — the edit page
// never got the Shoes-subcategory EU-sizing logic the create page has, and the category
// browse page's electronicsSubcategories had an extra "All Electronics" entry the vendor
// forms didn't. One shared source, three importers, going forward.
//
// Mirrored by hand in the mobile monorepo at
// apps/vendor/components/VendorProductForm.tsx (which duplicates CATEGORIES/
// ELECTRONICS_SUBCATEGORIES/FASHION_SUBCATEGORIES locally — no shared package bridges
// the two repos today).
export const CATEGORIES = [
  "Electronics",
  "Fashion",
  "Home & Garden",
  "Sports & Outdoors",
  "Books",
  "Toys & Games",
  "Health & Beauty",
  "Automotive",
  "Tools",
  "Food & Beverages",
]

export const FASHION_SUBCATEGORIES = [
  "Shoes",
  "Wig",
  "Jewelry",
  "Shirts",
  "Sweaters",
  "Swimwear",
  "Pants & Jeans",
  "Dresses",
  "Jackets & Coats",
  "Accessories",
  "Bags",
  "Hats & Caps",
  "Socks & Underwear",
]

// Every entry here that also appears in lib/variant-suggestions.ts's VARIANT_SUGGESTIONS
// gets a curated per-model/per-size variant picker on the vendor form; any subcategory
// not in that registry still works fine, just without pre-filled suggestions.
export const ELECTRONICS_SUBCATEGORIES = [
  "Phone Cases",
  "Mac Cases",
  "AirPods Cases",
  "Tablet Cases",
  "Screen Protectors",
  "Laptop Sleeves",
  "Chargers & Cables",
]

export const PREDEFINED_SIZES = ["S", "M", "L", "XL", "XXL"]
export const SHOE_SIZES = Array.from({ length: 31 }, (_, index) => String(index + 35)) // EU 35–65

export const PREDEFINED_COLORS = [
  "Black", "White", "Gray", "Red", "Blue", "Navy Blue", "Green", "Yellow",
  "Orange", "Pink", "Purple", "Brown", "Beige", "Cream", "Maroon", "Teal",
  "Turquoise", "Gold", "Silver", "Olive", "Burgundy", "Mint", "Lavender", "Coral",
]

export function isShoeSubcategory(category: string, subcategory: string): boolean {
  return category === "Fashion" && ["shoe", "shoes"].includes(subcategory.trim().toLowerCase())
}
