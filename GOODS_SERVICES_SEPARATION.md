# Goods & Services Separation Implementation

## Overview
Complete architectural separation of Goods and Services throughout the Branda marketplace, allowing vendors to specialize in physical products, professional services, or both.

---

## ✅ Completed Features

### 1. **Vendor Type System** 
**Location:** `lib/auth.ts`

Extended the `UserProfile` interface with vendor categorization:
```typescript
export interface UserProfile {
  uid: string
  email: string
  displayName: string
  role: "customer" | "vendor" | "admin" | "csa"
  vendorType?: "goods" | "services" | "both"  // NEW
  createdAt: Date
  updatedAt: Date
}
```

### 2. **Registration Flow Enhancement**
**Location:** `components/auth/SignupForm.tsx`

Added vendor type selection during signup:
- **Three Options:**
  - 🛍️ **Goods Only** - Physical products
  - 🛠️ **Services Only** - Professional services
  - ✨ **Both** - Goods & Services (default)

- **Contextual Helper Text:**
  - Goods: "You'll be able to list physical products in your store"
  - Services: "You'll be able to offer professional services and bookings"
  - Both: "You'll have access to both products and services management"

- **Integration:**
  - vendorType saved to formData state
  - Passed to `signUp()` function
  - Persisted in Firestore user profile

### 3. **Conditional Vendor Sidebar**
**Location:** `components/vendor/VendorSidebar.tsx`

Three specialized sidebar layouts with grouped navigation:

**Goods-Only Vendors:**
- Overview
- **🛍️ Products & Orders** section
  - Products
  - Orders
- **Store Management** section
  - Analytics, Store Settings, Support, Settings

**Services-Only Vendors:**
- Overview
- **🛠️ Services & Bookings** section
  - Services
  - Bookings
- **Business Management** section
  - Analytics, Store Settings, Support, Settings

**Both Vendors:**
- Overview
- **🛍️ My Goods** section
  - Products
  - Orders
- **🛠️ My Services** section
  - Services
  - Bookings
- **Management** section
  - Analytics, Store Settings, Support, Settings

**Quick Action Buttons:**
- Goods vendors: "Add Product" button
- Services vendors: "Add Service" button  
- Both vendors: Both buttons (primary + outline styles)

### 4. **Enhanced Service Portfolio**
**Location:** `app/vendor/services/new/page.tsx`

Increased image upload limit for service portfolios:
- **Previous:** Max 5 images
- **New:** Max 10 images (minimum 5 recommended)
- **Features:**
  - Image counter display: "Add Image (X/10)"
  - Warning tooltip if less than 5 images uploaded
  - Updated card title: "Service Portfolio Images"
  - Description: "Upload 5-10 images showcasing your past work"

---

## 🎯 Separation Architecture

### Database Level
```
UserProfile
├── vendorType: "goods" | "services" | "both"
└── role: "vendor"

Products Collection (Goods)
├── vendorId
├── title, description, price
└── category

Services Collection (Services)
├── providerId
├── title, description, pricing
└── serviceCategory
```

### UI/UX Level
```
Vendor Dashboard
├── Goods Vendors → Products, Orders, Product Management
├── Services Vendors → Services, Bookings, Portfolio
└── Both Vendors → Full Access to All Sections
```

### Navigation Structure
```
Main Site
├── /shop → Physical products marketplace
├── /services → Professional services marketplace
├── /product/[id] → Product details
└── /service/[id] → Service details with booking

Vendor Portal
├── /vendor/products → Manage goods (goods/both only)
├── /vendor/services → Manage services (services/both only)
├── /vendor/orders → Product orders (goods/both only)
└── /vendor/bookings → Service bookings (services/both only)
```

---

## 🔄 User Flows

### New Vendor Registration
1. User selects "Sign up as Seller"
2. Fills in account details (name, email, password)
3. **Selects Vendor Type** (Goods/Services/Both)
4. Sees contextual helper text
5. Continues with store setup (name, description, logo, etc.)
6. vendorType saved to Firestore user profile

### Vendor Dashboard Experience

**Goods-Only Vendor:**
- Sees: Products, Orders tabs in sidebar
- Quick Action: "Add Product" button
- No access to Services/Bookings sections

**Services-Only Vendor:**
- Sees: Services, Bookings tabs in sidebar
- Quick Action: "Add Service" button
- No access to Products/Orders sections
- Can upload 5-10 portfolio images per service

**Both Vendor:**
- Sees: All tabs (Products, Services, Orders, Bookings)
- Quick Actions: "Add Product" + "Add Service" buttons
- Full access to both marketplaces

### Customer Experience
- Clear separation between:
  - **Shop** → Browse physical products
  - **Services** → Browse professional services
- Different detail pages with appropriate actions:
  - Products → Add to Cart
  - Services → Book Appointment

---

## 🎨 Design Consistency

All implementations follow the existing Branda design system:
- **Accent Color:** #8b2e0b
- **Font:** Bebas Neue for headings
- **Animations:** fadeIn, scaleIn, hover-lift effects
- **Components:** shadcn/ui components (Select, Card, Button, etc.)
- **Responsive:** Mobile-first with adaptive navigation

---

## 📝 Code Changes Summary

### Modified Files
1. **lib/auth.ts**
   - Added `vendorType` field to UserProfile interface
   - Updated `signUp()` function to accept and persist vendorType

2. **components/auth/SignupForm.tsx**
   - Added vendorType to formData state
   - Inserted vendor type selection dropdown with three options
   - Added contextual helper text based on selection
   - Passed vendorType to signUp function call

3. **components/vendor/VendorSidebar.tsx**
   - Imported AuthContext to access userProfile
   - Added `showFor` property to each sidebar item
   - Implemented `filteredItems` with useMemo to filter based on vendorType
   - Added conditional quick action buttons (Add Product/Service)
   - Dynamic navigation rendering based on vendor type

4. **app/vendor/services/new/page.tsx**
   - Increased image limit from 5 to 10
   - Updated card title to "Service Portfolio Images"
   - Added image counter: "Add Image (X/10)"
   - Added warning for less than 5 images

---

## ✅ Testing Checklist

- [ ] Register new vendor with "Goods Only" → Only see Products/Orders in dashboard
- [ ] Register new vendor with "Services Only" → Only see Services/Bookings in dashboard
- [ ] Register new vendor with "Both" → See all sections in dashboard
- [ ] Upload 10 portfolio images for a service → All upload successfully
- [ ] Upload 3 images for service → See warning about minimum 5 recommended
- [ ] Verify vendorType persists in Firestore after registration
- [ ] Check conditional quick action buttons appear correctly
- [ ] Test mobile navigation filtering

---

## 🔮 Future Enhancements (Optional)

- [ ] Add vendor type filter on homepage (show only relevant sections)
- [ ] Implement search type filtering (goods vs services)
- [ ] Create unified analytics dashboard for "both" vendors with separate metrics
- [ ] Add vendor type badge on store profile pages
- [ ] Enable vendor type switching from settings (with approval workflow)

---

## 📄 Related Files

**Authentication & Profiles:**
- `lib/auth.ts` - User authentication and profile management
- `contexts/AuthContext.tsx` - Auth state management

**Registration:**
- `components/auth/SignupForm.tsx` - Vendor signup with type selection

**Vendor Dashboard:**
- `components/vendor/VendorSidebar.tsx` - Conditional navigation
- `app/vendor/dashboard/page.tsx` - Main dashboard
- `app/vendor/products/` - Goods management
- `app/vendor/services/` - Services management
- `app/vendor/orders/` - Product orders
- `app/vendor/bookings/` - Service bookings

**Data Models:**
- `lib/firestore.ts` - Service, Booking, Product interfaces

---

**Implementation Date:** December 2024  
**Status:** ✅ Complete  
**Design Pattern:** Maintained existing Branda design system
