# Vendor Storefront Page Architecture (Public Vendor Page)

This document explains how the public vendor storefront was built in MakeItSell: page structure, code organization, API flow, state management, and the key implementation patterns used.

---

## 1) What “Vendor Page” Means Here

In this codebase, the public vendor page is the storefront route:

- `/stores` → list of all stores
- `/store/[id]` → single vendor/storefront details + products

Main files:

- `app/stores/page.tsx` (stores listing and entry into a single store)
- `app/store/[id]/page.tsx` (full vendor storefront page)
- `app/store/[id]/store-mobile-fix.css` (mobile-specific layout fix)

---

## 2) High-Level Structure

### A) Entry Flow

1. User opens `/stores`
2. App fetches stores from `/api/database/stores`
3. User clicks a store card
4. Router navigates to `/store/${storeId}`
5. Store page fetches:
   - store info from `/api/database/stores/${storeId}`
   - products from `/api/database/products?vendorId=${store.vendorId}`

### B) UI Areas on `/store/[id]`

The page is organized into these sections:

1. **Header + Hero**
   - Store image/banner background
   - Store logo, title, status badges (verified/open)
   - Follow button

2. **Tabs**
   - `Products` tab
   - `About Store` tab

3. **Products Tab Content**
   - Search input
   - Category filter
   - Price range filter
   - Sort selector
   - Product grid cards
   - Empty states

4. **Quick View Modal**
   - Full product details
   - Color/size variation selection
   - Add to cart

---

## 3) Core Files and Responsibilities

## `app/stores/page.tsx`

Responsibility:

- Fetch all stores
- Search/filter/sort stores client-side
- Render store cards
- Navigate to `/store/[id]`

Key logic:

```tsx
const fetchStores = async () => {
  const params = new URLSearchParams()
  if (selectedCategory !== "all") params.append("category", selectedCategory)
  params.append("limit", "20")

  const response = await fetch(`/api/database/stores?${params}&t=${Date.now()}`)
  const data = await response.json()
  if (data.success) setStores(data.data || [])
}

const handleStoreClick = (storeId: string) => {
  setIsTransitioning(true)
  setTimeout(() => router.push(`/store/${storeId}`), 600)
}
```

---

## `app/store/[id]/page.tsx`

Responsibility:

- Load store data and vendor products
- Handle follow/unfollow
- Handle product filters, sorting, and search
- Handle cart add
- Open/close quick view modal
- Render `About Store` details

### Main state used

- `store`, `products`, `filteredProducts`
- `loading`, `searchQuery`, `sortBy`, `categoryFilter`, `priceRange`
- `isFollowing`, `followLoading`
- `selectedProduct`, `quickViewOpen`

### Core data fetch

```tsx
const fetchStoreData = async () => {
  const storeResponse = await fetch(`/api/database/stores/${storeId}`)
  const storeResult = await storeResponse.json()

  if (storeResult.success) {
    setStore(storeResult.data)

    const productsResponse = await fetch(
      `/api/database/products?vendorId=${storeResult.data.vendorId}`
    )
    const productsResult = await productsResponse.json()

    if (productsResult.success && productsResult.data) {
      setProducts(productsResult.data)
      setFilteredProducts(productsResult.data)
    }
  }
}
```

### Filter + sort pipeline

```tsx
useEffect(() => {
  let filtered = [...products]

  if (searchQuery) {
    filtered = filtered.filter(product =>
      (product.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }

  if (categoryFilter !== "all") {
    filtered = filtered.filter(product => product.category === categoryFilter)
  }

  if (priceRange !== "all") {
    const [min, max] = priceRange.split("-").map(Number)
    filtered = max
      ? filtered.filter(product => product.price >= min && product.price <= max)
      : filtered.filter(product => product.price >= min)
  }

  switch (sortBy) {
    case "price-low":
      filtered.sort((a, b) => a.price - b.price)
      break
    case "price-high":
      filtered.sort((a, b) => b.price - a.price)
      break
    case "newest":
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      break
    case "popular":
      filtered.sort((a, b) => b.sales - a.sales)
      break
  }

  setFilteredProducts(filtered)
}, [products, searchQuery, sortBy, categoryFilter, priceRange])
```

### Add to cart integration

```tsx
const handleAddToCart = (product: Product) => {
  addItem({
    productId: product.id,
    id: product.id,
    title: product.title || product.name || '',
    price: product.price,
    image: product.images?.[0] || '',
    maxStock: product.stock || 100,
    vendorId: product.vendorId,
    vendorName: product.vendorName || 'Unknown Vendor'
  })

  notification.success('Product added to cart', product.title || product.name || 'Added to cart', 3000)
}
```

---

## `components/ui/product-quick-view.tsx`

Responsibility:

- Show selected product details in modal dialog
- Image gallery + thumbnail switch
- Variation selectors (color and size)
- Add-to-cart trigger passed from parent page

Key pattern:

```tsx
export function ProductQuickView({ product, open, onClose, onAddToCart, storeName }: ProductQuickViewProps) {
  const [mainImage, setMainImage] = useState<string>("")
  const [selectedColor, setSelectedColor] = useState<string>("")
  const [selectedSize, setSelectedSize] = useState<string>("")

  useEffect(() => {
    setSelectedColor("")
    setSelectedSize("")
    setMainImage("")
  }, [open, product])

  if (!product) return null

  const displayImage = mainImage || product.images?.[0] || "/placeholder.svg"
  // ... render dialog
}
```

---

## 4) API Layer Used by Vendor Storefront

## `app/api/database/stores/route.ts`

Used by `/stores` list page.

- GET supports filters like `category`, `vendorId`, `limit`
- Maps DB store fields into frontend-friendly shape (`name`, `description`, `logoImage`, `bannerImage`, `productCount`, etc.)

## `app/api/database/stores/[id]/route.ts`

Used by `/store/[id]` page.

- GET accepts a store id (or vendor id fallback)
- Supports `virtual-*` ids by synthesizing a store object from vendor account data
- Tries lookup by `vendorId` first, then by Mongo `_id`

## `app/api/database/products/route.ts`

Used by `/store/[id]` page for products.

- GET supports `vendorId`, `category`, `featured`, `limit`
- Returns mapped product list with normalized `id`

## `app/api/store/follow/route.ts`

Used by follow feature.

- `GET ?storeId=&customerId=` returns `{ isFollowing: boolean }`
- `POST` handles `follow` / `unfollow` actions

---

## 5) Database Operations Behind the APIs

In `lib/mongodb-operations.ts` the storefront-related methods are:

- `getStoreById(id)`
- `getStoreByVendorId(vendorId)`
- `getStores(filters)`
- `getProducts(filters)`

The `getProducts` function applies query filters (including `vendorId`) then maps Mongo `_id` to frontend `id` for UI consistency.

---

## 6) Context/Provider Dependencies

The vendor page uses shared app contexts:

- `useAuth()` from `contexts/AuthContext.tsx`
  - determines if user can follow store
- `useCart()` from `contexts/CartContext.tsx`
  - adds products to cart
- `useNotification()` from `contexts/NotificationContext.tsx`
  - shows success/error feedback

Mounted globally in `app/layout.tsx` through:

- `<AuthProvider>`
- `<CartProvider>`
- `<GlobalClientProviders>` (contains `NotificationProvider`)

---

## 7) UI/UX Patterns Used

1. **Client rendering (`"use client"`)** for dynamic interactions.
2. **Loading skeleton state** while fetch completes.
3. **Not-found fallback UI** when store cannot be loaded.
4. **Animated page transitions** when navigating back/forth.
5. **Responsive layout** with dedicated mobile CSS fixes.
6. **Interactive product cards**:
   - image cycling on hover
   - stock badges
   - quick-view launch
7. **Tabs-based information architecture**:
   - products browsing
   - store details/metadata

---

## 8) End-to-End Runtime Flow (Practical)

1. User taps a store on `/stores`.
2. App navigates to `/store/[id]`.
3. Page loads store metadata.
4. Page loads products via store vendor id.
5. User can:
   - search/filter/sort products
   - open quick view
   - add product to cart
   - follow/unfollow store (if authenticated)
6. Cart and notifications update instantly through shared contexts.

---

## 9) Quick “Code Map” for Team Handover

- Public list page: `app/stores/page.tsx`
- Public single vendor page: `app/store/[id]/page.tsx`
- Product quick view UI: `components/ui/product-quick-view.tsx`
- Store list API: `app/api/database/stores/route.ts`
- Single store API: `app/api/database/stores/[id]/route.ts`
- Product API: `app/api/database/products/route.ts`
- Follow API: `app/api/store/follow/route.ts`
- DB data ops: `lib/mongodb-operations.ts`
- Auth/cart/notifications: `contexts/AuthContext.tsx`, `contexts/CartContext.tsx`, `contexts/NotificationContext.tsx`

---

## 10) Summary

The vendor storefront is built as a **client-driven Next.js route** backed by MongoDB APIs. The design separates:

- **Page UI composition** (`app/store/[id]/page.tsx`)
- **Reusable modal UI** (`ProductQuickView`)
- **API adapters/normalization** (route handlers)
- **DB query logic** (`mongodb-operations.ts`)
- **Cross-cutting app state** (auth/cart/notifications contexts)

This separation makes it easier to maintain, test, and evolve each layer independently (UI, API, data, shared state).
