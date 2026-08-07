# Make It Sell - Dual Marketplace Platform 🛍️🛠️

A comprehensive Next.js marketplace that seamlessly integrates **physical products** and **professional services** with advanced booking capabilities, multi-vendor support, and AI-powered customer assistance.

## 🚀 Project Overview

**Make It Sell** is a modern e-commerce platform built with Next.js that allows vendors to:
- Sell physical products (goods)
- Offer professional services with booking system
- Manage both simultaneously
- Access specialized dashboards based on their business type

The platform serves several distinct user roles with tailored experiences: **Customers**, **Vendors**, **Admins**, **Customer Service Agents / Logistics (CSA)**, and **Riders**.

---

## 🏗️ Architecture & Tech Stack

### **Frontend**
- **Framework:** Next.js 16 (App Router, Turbopack dev server)
- **Language:** TypeScript 5+
- **Styling:** Tailwind CSS 4 + TailwindCSS Animate
- **UI Components:** Radix UI (comprehensive component library)
- **Animations:** Framer Motion
- **Forms:** React Hook Form + Zod validation
- **State Management:** React Context (Auth, Cart, Notifications)
- **Icons:** Lucide React
- **Package Manager:** npm

### **Backend & Services**
- **Database:** MongoDB (via Mongoose) — the platform migrated off Firebase Firestore; see `MONGODB_MIGRATION.md` for history
- **Authentication:** Custom email/password auth (`lib/auth-mongo.ts`), bcrypt-hashed passwords, session cookie + JWT, role-based route guards (`lib/server-route-auth.ts`)
- **File/Image Storage:** Cloudinary
- **Hosting:** Vercel
- **AI Integration:** Google Gemini AI (support chatbot, product description generation)
- **Analytics:** Vercel Analytics
- **Payments:** Paystack (checkout, vendor subscriptions, wallet top-ups/withdrawals)
- **Delivery:** Shipbubble (live courier rates and dispatch)
- **Messaging:** WhatsApp Cloud API (buyer-facing bot — product search, checkout, order status)
- **Legacy:** `lib/firebase.ts` and `firestore.rules` remain in the repo from the pre-migration Firebase setup but are not the active data layer

### **Development Tools**
- **Build Tools:** PostCSS, Autoprefixer
- **Type Safety:** Full TypeScript coverage
- **Package Management:** npm (a stale `pnpm-lock.yaml` also exists in the repo from an earlier setup — npm is what's actually used)

---

## 📁 Project Structure

```
├── 📄 Configuration Files
│   ├── next.config.mjs          # Next.js configuration
│   ├── tsconfig.json            # TypeScript configuration
│   ├── tailwind.config.js       # Tailwind CSS configuration
│   ├── components.json          # shadcn/ui configuration
│   ├── firebase.json            # Firebase deployment config
│   ├── firestore.rules          # Firestore security rules
│   ├── firestore.indexes.json   # Database composite indexes
│   ├── package.json             # Dependencies and scripts
│   └── pnpm-workspace.yaml      # Workspace configuration
│
├── 📚 Documentation
│   ├── AUTH_FIX_SUMMARY.md      # Authentication fixes log
│   ├── FIREBASE_SETUP.md        # Firebase setup instructions
│   ├── GOODS_SERVICES_SEPARATION.md # Feature implementation guide
│   ├── ISSUE_PREVENTION.md      # Common issues and solutions
│   ├── MANUAL_FIREBASE_FIX.md   # Manual Firebase troubleshooting
│   ├── QUICK_FIX.md            # Quick fixes reference
│   └── SIGNUP_FIX.md           # Signup-specific fixes
│
├── 🎨 Frontend Structure
│   ├── app/                     # Next.js App Router
│   │   ├── layout.tsx           # Root layout with providers
│   │   ├── page.tsx             # Homepage
│   │   ├── globals.css          # Global styles
│   │   │
│   │   ├── 🛍️ E-commerce Pages
│   │   │   ├── shop/            # Product listings
│   │   │   │   ├── page.tsx     # Basic shop interface
│   │   │   │   └── enhanced/
│   │   │   │       └── page.tsx # Enhanced shop with smart discovery
│   │   │   ├── services/        # Service marketplace
│   │   │   ├── categories/      # Category browser
│   │   │   ├── category/[slug]/ # Category-specific products
│   │   │   ├── product/[id]/    # Product details
│   │   │   ├── service/[id]/    # Service details
│   │   │   ├── cart/           # Shopping cart
│   │   │   ├── checkout/       # Checkout process
│   │   │   ├── deals/          # Special offers
│   │   │   └── store/[id]/     # Vendor storefronts
│   │   │
│   │   ├── 👤 User Management
│   │   │   ├── login/          # Authentication
│   │   │   ├── signup/         # Registration with vendor type selection
│   │   │   ├── user/           # User profile
│   │   │   └── unauthorized/   # Access denied page
│   │   │
│   │   ├── 🏪 Vendor Dashboard
│   │   │   └── vendor/
│   │   │       ├── dashboard/   # Overview analytics
│   │   │       ├── products/    # Product management
│   │   │       ├── services/    # Service management
│   │   │       ├── orders/      # Order fulfillment
│   │   │       ├── bookings/    # Service bookings
│   │   │       ├── analytics/   # Business insights
│   │   │       ├── store/       # Storefront customization
│   │   │       ├── store-settings/ # Store configuration
│   │   │       ├── settings/    # Account settings
│   │   │       └── support/     # Vendor support tickets
│   │   │
│   │   ├── 🛡️ Admin Panel
│   │   │   └── admin/
│   │   │       ├── dashboard/   # Platform overview
│   │   │       ├── users/       # User management
│   │   │       └── support/     # Support ticket system
│   │   │
│   │   ├── 🤝 Customer Support
│   │   │   ├── support/        # Help center
│   │   │   ├── messages/       # Customer messaging
│   │   │   └── become-seller/  # Vendor onboarding
│   │   │
│   │   ├── 📋 Order Management
│   │   │   ├── order/          # Order details
│   │   │   └── order-confirmation/ # Order success
│   │   │
│   │   └── 📄 Legal & Info
│   │       ├── about/          # About page
│   │       ├── contact/        # Contact information
│   │       ├── terms/          # Terms of service
│   │       ├── privacy/        # Privacy policy
│   │       ├── cookies/        # Cookie policy
│   │       ├── shipping/       # Shipping information
│   │       └── returns/        # Return policy
│   │
│   ├── components/             # Reusable UI components
│   │   ├── 🎯 Core Components
│   │   │   ├── Header.tsx      # Navigation header
│   │   │   ├── Footer.tsx      # Site footer
│   │   │   ├── HeroSection.tsx # Homepage hero
│   │   │   ├── CategorySection.tsx # Category display
│   │   │   ├── FeaturedProducts.tsx # Product showcase
│   │   │   ├── FeaturedServices.tsx # Service showcase
│   │   │   ├── TestimonialsSection.tsx # Customer reviews
│   │   │   └── theme-provider.tsx # Dark/light theme
│   │   │
│   │   ├── 🔐 Authentication
│   │   │   ├── auth/
│   │   │   │   ├── LoginForm.tsx    # Login interface
│   │   │   │   ├── SignupForm.tsx   # Registration with vendor type
│   │   │   │   ├── ProtectedRoute.tsx # Route protection
│   │   │   │   └── UserMenu.tsx     # User dropdown
│   │   │
│   │   ├── 🛒 Shopping
│   │   │   └── cart/
│   │   │       └── CartSidebar.tsx  # Cart slide-out
│   │   │
│   │   ├── � Smart Discovery
│   │   │   ├── search/
│   │   │   │   ├── SmartSearch.tsx      # Intelligent search with autocomplete
│   │   │   │   └── AdvancedFilters.tsx  # Comprehensive filtering system
│   │   │   └── discovery/
│   │   │
│   │   ├── �🛠️ Services
│   │   │   └── services/
│   │   │       └── BookingModal.tsx # Service booking interface
│   │   │
│   │   ├── 🏪 Vendor
│   │   │   └── vendor/
│   │   │       └── [specialized components] # Vendor-specific UI
│   │   │
│   │   ├── 🛡️ Admin
│   │   │   └── admin/
│   │   │       ├── AdminLayout.tsx  # Admin panel layout
│   │   │       └── AdminSidebar.tsx # Admin navigation
│   │   │
│   │   ├── 🎧 Support
│   │   │   └── support/
│   │   │       └── [support components] # Help & ticketing
│   │   │
│   │   └── 🧩 UI Primitives
│   │       └── ui/                  # shadcn/ui components
│   │           ├── button.tsx
│   │           ├── input.tsx
│   │           ├── dialog.tsx
│   │           └── [50+ components]
│   │
│   ├── contexts/               # React Context providers
│   │   ├── AuthContext.tsx     # Authentication state
│   │   └── CartContext.tsx     # Shopping cart state
│   │
│   ├── hooks/                  # Custom React hooks
│   │   ├── use-mobile.ts       # Mobile detection
│   │   └── use-toast.ts        # Notification system
│   │
│   └── lib/                    # Utility libraries
│       ├── mongodb.ts          # MongoDB/Mongoose connection (primary database)
│       ├── auth-mongo.ts       # Authentication (session cookie + JWT, bcrypt)
│       ├── server-route-auth.ts # Session/role checks for API routes
│       ├── firebase.ts         # Legacy Firebase client config (not the active DB)
│       ├── firestore.ts        # Legacy compatibility shim — no-op, kept so old imports don't break
│       ├── cloudinary-url.ts   # Image processing/delivery
│       ├── gemini-ai.ts        # AI chatbot integration
│       └── utils.ts            # General utilities
│
├── 🗄️ Database & Storage
│   ├── dataconnect/            # Firebase Data Connect
│   │   ├── dataconnect.yaml    # GraphQL configuration
│   │   ├── seed_data.gql       # Initial data seeding
│   │   ├── schema/             # GraphQL schemas
│   │   └── example/            # Example queries
│   │
│   └── src/
│       └── dataconnect-generated/ # Generated GraphQL types
│
├── 🎨 Assets
│   ├── public/
│   │   ├── images/             # Static images
│   │   └── test-firebase.html  # Firebase connection test
│   │
│   └── styles/
│       └── globals.css         # Additional global styles
│
└── 🧪 Testing
    └── test/                   # Test environment (duplicate structure)
        ├── [mirror of main structure for testing]
        └── components.json
```

---

## 🎯 Key Features & Functionality

### **🛍️ Dual Marketplace System**

#### **Goods Marketplace**
- **Product Catalog:** Comprehensive product listings with categories
- **Inventory Management:** Stock tracking and availability
- **Product Variants:** Size, color, and option selections
- **Image Galleries:** Multiple product images with zoom
- **Product Search & Filters:** Advanced filtering by category, price, ratings
- **Reviews & Ratings:** Customer feedback system

#### **🛠️ Services Marketplace**
- **Service Listings:** Professional service offerings
- **Portfolio Showcases:** 5-10 image portfolios for service providers
- **Booking System:** Real-time appointment scheduling
- **Service Categories:** Organized professional service types
- **Time Slot Management:** Availability calendar system
- **Service Reviews:** Client testimonial system

### **🧠 Smart Product Discovery Experience**

#### **🔍 Intelligent Search System**
- **Smart Autocomplete:** Real-time suggestions with product names, brands, categories, and trending tags
- **Search History:** Recently searched items with quick access
- **Trending Searches:** Popular search terms updated in real-time
- **Context-Aware Results:** Search results adapt based on user behavior
- **Voice Search Ready:** Expandable to support voice search capabilities
- **Typo Tolerance:** Intelligent matching for misspelled queries

**Features:**
- Debounced search with 200ms delay for performance
- Keyboard navigation (arrow keys, enter, escape)
- Click-outside-to-close functionality
- Mobile-responsive dropdown interface
- Integration with recommendation engine for enhanced results

#### **🎛️ Advanced Filtering System**
- **Price Range Slider:** Dynamic price filtering with preset ranges
- **Visual Color Filter:** Color swatches with product count
- **Material Selection:** Fabric, metal, wood, plastic, etc.
- **Brand Filtering:** Popular brands with verification badges
- **Rating Filter:** 5-star rating system with "& Up" options
- **Condition Filter:** New, like-new, good, fair conditions
- **Special Features:** Free shipping, verified sellers, new arrivals, eco-friendly
- **Category Hierarchy:** Main categories with subcategory drilling

**Advanced Capabilities:**
- Real-time filter count updates
- Active filter badge display
- Quick reset functionality
- Mobile sheet interface for touch devices
- Filter combination logic with AND/OR operators
- Save filter preferences (localStorage)

#### **📊 Dynamic Collections with Smart Algorithms**

**Make It Sell Picks**
- Algorithm: `(rating × 0.3) + (sales × 0.25) + (likes × 0.2) + (verified_vendor × 0.25)`
- Curation: AI-powered selection of premium quality products
- Criteria: Vendor reliability, product quality score, customer satisfaction

**Under ₦20,000**
- Algorithm: `(rating.average × rating.count) / price` (value optimization)
- Focus: Maximum value for money under budget threshold
- Updates: Daily price monitoring and value recalculation

**Trending Now**
- Algorithm: `(views + likes×2 + sales×5) / days_since_creation`
- Factors: Recent popularity surge, viral potential, momentum tracking
- Time Decay: Higher weight for recent activity

**New Arrivals**
- Filter: Products added within last 7 days
- Sort: `createdAt DESC` with quality filtering
- Quality Gate: Minimum vendor verification and product completeness

**Flash Deals**
- Filter: `discount > 15% AND onSale = true`
- Sort: Discount percentage descending
- Time Sensitivity: Limited-time offers with countdown timers
- **Persistent Storage:** LocalStorage with 50-item capacity
- **Smart Deduplication:** Automatic removal of duplicate views
- **Time Tracking:** Relative timestamps (minutes, hours, days ago)
- **Quick Actions:** Remove individual items or clear all
- **Cross-Session:** Maintains history across browser sessions
- **Privacy Friendly:** Data stored locally, not transmitted to servers

**Display Modes:**
- Horizontal scroll for homepage
- Vertical list for dedicated page
- Compact grid for sidebar placement
- Mobile-responsive layouts

#### **🎯 AI-Powered Recommendations Engine**

**Personalized Recommendations ("For You")**
- **User Behavior Analysis:** Viewing patterns, search history, purchase data
- **Category Preferences:** Weighted by time spent and interaction frequency
- **Price Range Learning:** Adaptive pricing based on user's budget patterns
- **Brand Affinity:** Preferred brands based on search and purchase history
- **Algorithm:** Multi-factor scoring with machine learning potential

**Collaborative Filtering ("Others Also Viewed")**
- **Similar User Patterns:** Users with comparable browsing behavior
- **Co-occurrence Analysis:** Products frequently viewed together
- **Social Proof Integration:** Popular items among similar demographics
- **Engagement Metrics:** Views, likes, sales data from similar users

**Content-Based Filtering ("Similar Items")**
- **Product Similarity:** Category, subcategory, tag matching
- **Price Range Correlation:** Similar price points for comparable products
- **Vendor Relationship:** Same or verified vendor products
- **Feature Matching:** Color, material, style attributes

**Hybrid Approach ("Smart Picks")**
- **Multi-Algorithm Fusion:** Combines all recommendation types
- **Weighted Scoring:** 40% personalized, 30% collaborative, 20% content, 10% trending
- **Machine Learning Ready:** Expandable to neural networks and deep learning
- **A/B Testing Support:** Different algorithm weights for optimization

**Performance Features:**
- Real-time recommendation updates
- Recommendation explanation ("Because you viewed...")
- Refresh capability for new suggestions
- Cross-category discovery
- Seasonal and trending adjustments

#### **📱 Mobile-First Discovery Experience**
- **Touch-Optimized:** Finger-friendly interface elements
- **Swipe Gestures:** Horizontal scrolling for collections
- **Sheet Interfaces:** Bottom sheets for filters on mobile
- **Progressive Loading:** Skeleton states and lazy loading
- **Offline Capability:** Cached recommendations

### **👥 Multi-Role User System**

#### **🛒 Customers**
- **Account Management:** Profile, order history, preferences
- **Shopping Cart:** Persistent cart across sessions
- **Wishlist:** Save favorite products and services
- **Order Tracking:** Real-time order status updates
- **Service Bookings:** Schedule and manage appointments
- **Reviews:** Leave feedback for purchases and services
- **Support Tickets:** Customer service communication

#### **🏪 Vendors (Three Types)**

**Goods-Only Vendors:**
```
📊 Dashboard Overview
├── 📈 Sales Analytics
├── 🛍️ Products & Orders Section
│   ├── Product Management (Add, Edit, Delete)
│   ├── Inventory Tracking
│   ├── Order Fulfillment
│   └── Shipping Management
└── 🏪 Store Management
    ├── Store Analytics
    ├── Store Settings
    ├── Customer Support
    └── Account Settings
```

**Services-Only Vendors:**
```
📊 Dashboard Overview
├── 📈 Booking Analytics
├── 🛠️ Services & Bookings Section
│   ├── Service Management
│   ├── Portfolio Management (10-image limit)
│   ├── Booking Calendar
│   └── Client Management
└── 💼 Business Management
    ├── Performance Analytics
    ├── Store Settings
    ├── Customer Support
    └── Account Settings
```

**Both (Hybrid Vendors):**
```
📊 Dashboard Overview
├── 📈 Combined Analytics
├── 🛍️ My Goods Section
│   ├── Products
│   └── Orders
├── 🛠️ My Services Section
│   ├── Services
│   └── Bookings
└── 🎛️ Management Section
    ├── Unified Analytics
    ├── Store Settings
    ├── Customer Support
    └── Account Settings
```

#### **🛡️ Administrators**
- **User Management:** Manage all user accounts and roles
- **Platform Analytics:** System-wide performance metrics
- **Content Moderation:** Review and approve listings
- **Support Oversight:** Manage customer service operations
- **System Configuration:** Platform settings and features

#### **🎧 Customer Service Agents (CSA)**
- **Ticket Management:** Handle customer support requests
- **Live Chat:** Real-time customer assistance
- **AI Integration:** Gemini AI-powered response suggestions
- **Escalation System:** Route complex issues to supervisors
- **Knowledge Base:** Access to help documentation

### **🔐 Advanced Authentication System**

#### **Signup Process with Vendor Type Selection**
```typescript
// Vendor type selection during registration
interface VendorTypeOption {
  type: "goods" | "services" | "both"
  title: string
  description: string
  icon: React.ReactNode
}

const vendorTypes = [
  {
    type: "goods",
    title: "Goods Only",
    description: "You'll be able to list physical products in your store",
    icon: <Package className="h-5 w-5" />
  },
  {
    type: "services", 
    title: "Services Only",
    description: "You'll be able to offer professional services and bookings",
    icon: <Wrench className="h-5 w-5" />
  },
  {
    type: "both",
    title: "Both",
    description: "You'll have access to both products and services management",
    icon: <Sparkles className="h-5 w-5" />
  }
]
```

#### **Role-Based Access Control**
- **Route Protection:** Pages restricted by user role
- **Component-Level Security:** UI elements shown based on permissions
- **API Security:** Backend endpoints protected via session/role checks (`requireRoles`, `requireAdminAccess` in `lib/server-route-auth.ts`)

#### **Authentication Features**
- **Email/Password Authentication:** bcrypt-hashed passwords, custom signup/login flow
- **Session Management:** HTTP-only session cookie + JWT
- **Error Handling:** User-friendly error messages

---

## 🔧 Database Schema & Architecture

### **MongoDB Collections (Mongoose)**

The full schema for each model lives in `lib/models/*.ts` (and a few, like `Product`/`Service`, in `lib/mongodb-operations.ts`). Simplified shapes below — see those files for the authoritative field list.

#### **Users**
```typescript
{
  email: string
  passwordHash: string           // bcrypt
  name?: string
  displayName?: string
  role: string                   // "customer" | "vendor" | "admin" | "csa" | "rider" (free-form, default "customer")
  phone?: string
  phone_verified: boolean
  walletBalance: number          // total of earned/deposited/prize balances below
  earnedBalance: number          // product-sale commissioned funds
  depositedBalance: number       // vendor top-ups
  prizeBalance: number           // streak/referral/champion rewards
  withdrawalPinHash?: string
  createdAt, updatedAt: Date
}
```

#### **Products** (`lib/models/Product.ts`)
```typescript
{
  vendorId: string
  vendorName?: string
  storeId?: string
  name: string
  description?: string
  price: number
  category?: string
  subcategory?: string
  images: string[]
  stock: number
  lowStockThreshold: number
  featured: boolean
  status: "active" | "inactive" | "out_of_stock"
  sales: number
  hasColorOptions, hasSizeOptions: boolean
  imageHash?: string              // for photo-based WhatsApp search (dHash)
  visualCategory?: string         // for photo-based WhatsApp search (embedding classification)
}
```

#### **Services** (`lib/mongodb-operations.ts` — `ServiceSchema`)
```typescript
{
  providerId: string
  providerName: string
  title: string
  description: string
  category: string
  subcategory?: string
  price: number
  pricingType: string
  packageOptions: Array<{ id, name, price, duration, images, pricingType, active }>
  addOnOptions: Array<{ id, name, pricingType: "fixed" | "percentage", amount, active }>
  requiresQuote: boolean
  quoteSlaHours: number
  locationPricingRules: Array<{ label, matchType, matchValue }>
}
```

#### **Orders** (`lib/models/Order.ts`)
```typescript
{
  orderId: string
  customerId: string
  items: any[]
  vendors: any[]                  // per-vendor legs of a multi-vendor order, each with its own status
  shippingAddress: any
  paymentMethod: string
  totalAmount: number
  status: string
  paymentStatus: string
  paymentReference?: string
  escrowReleaseAt?: Date          // release tied to actual courier delivery, not a flat timer
  disputeStatus?: string
  disputeData?: any
  refundedAt?: Date
  createdAt: Date
}
```

#### **Bookings** (`lib/models/Booking.ts`)
```typescript
{
  serviceId: string
  customerId, customerName, customerEmail: string
  providerId, providerName: string
  selectedPackageId?, selectedAddOns?: any
  estimatedPrice?, finalPrice?: number
  pricingStatus: "estimated" | "quoted" | "accepted"
  requiresQuote: boolean
  bookingDate: Date
  startTime, endTime: string
  status: "pending" | "confirmed" | "completed" | "cancelled"
  cancellationPolicyPercent?: number
}
```

### **Authorization**
Enforced in application code (`lib/server-route-auth.ts`), not database-level rules:
- `getSessionUserFromRequest()` — resolves the caller's session cookie to a user
- `requireRoles(request, roles)` — 401 if unauthenticated, 403 if role not allowed
- `requireAdminAccess(request)` — admin-only routes, also accepts an `ADMIN_SECRET` bearer token for server-to-server calls
- `requireCronOrAdminAccess(request)` — cron-job routes, accepts a `CRON_SECRET` bearer token

### **Indexes**
Defined directly on the Mongoose schemas (e.g. `Product`'s text index for search, `SupportTicket`'s `customerId`/`status`/`priority` indexes) rather than a separate Firestore composite-index config.

---

## 🎨 UI/UX Design System

### **Component Architecture**
- **Design System:** Built on Radix UI primitives
- **Theming:** Dark/light mode support
- **Responsive:** Mobile-first responsive design
- **Accessibility:** WCAG 2.1 AA compliant
- **Animation:** Framer Motion for smooth interactions

### **Styling Approach**
- **Utility-First:** Tailwind CSS for rapid development
- **Component Variants:** Class Variance Authority for component variants
- **CSS Variables:** CSS custom properties for theming
- **Mobile Optimization:** Touch-friendly interface elements

### **User Experience Features**
- **Progressive Loading:** Skeleton states and lazy loading
- **Error Boundaries:** Graceful error handling
- **Offline Support:** Works without internet connection
- **Performance:** Optimized for Core Web Vitals
- **Search:** Advanced search with filters and suggestions

---

## 🚀 Installation & Setup

### **Prerequisites**
- **Node.js:** v20+ (or 22 LTS)
- **npm:** ships with Node
- **MongoDB:** a connection string (Atlas or self-hosted)
- **Git:** For version control

### **Quick Start**

1. **Clone the Repository**
   ```bash
   git clone https://github.com/Aniefiokidi/MAKEITSELL.git
   cd MakeItSell
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   - Copy `.env.example` to `.env.local` and fill in the values
   - At minimum you'll need `MONGODB_URI`; other integrations (Cloudinary, Paystack, Gemini AI, WhatsApp Cloud API, Shipbubble) each read their own keys from `process.env` in their respective `lib/*.ts` files — check there if a feature needs a key not yet documented in `.env.example`

4. **Start Development Server**
   ```bash
   npm run dev
   ```

5. **Access the Application**
   - Open [http://localhost:3000](http://localhost:3000)

### **Production Deployment**

The app deploys to **Vercel** (see `vercel.json`); pushing to `main` is normally enough. To build locally:
```bash
npm run build
npm start
```

---

## 📊 Development Scripts

```json
{
  "scripts": {
    "dev": "next dev",                          // Start development server (Turbopack)
    "build": "next build",                      // Build for production
    "start": "next start",                      // Start production server
    "lint": "next lint",                        // Run ESLint
    "resend:verification": "node scripts/bulk-resend-verification.js"
  }
}
```

### **Additional Commands**
```bash
# Package management
npm install [package]            # Add dependency
npm install -D [package]         # Add dev dependency
npm update                       # Update all packages
```

There are also a number of one-off maintenance/migration scripts at the repo root and in `scripts/` (data backfills, subscription checks, test-email senders, etc.) — run with `node <script>.js`; check the script itself before running, most are one-time-use.

---

## 🔍 API & Integration Points

### **Internal API**
All app data access goes through Next.js route handlers under `app/api/` (mostly `app/api/database/*` for CRUD, plus feature-specific routes like `app/api/auth/*`, `app/api/payments/*`, `app/api/whatsapp/*`). None of it is exposed via Firestore client SDK calls or real-time subscriptions — every read/write is a server-side route backed by Mongoose.

### **External Integrations**

#### **Google Gemini AI**
- **Customer Support:** AI-powered chatbot assistance (`app/api/support/ai`)
- **Content Generation:** AI-assisted service descriptions

#### **Cloudinary**
- **Image Processing:** Automatic optimization and resizing
- **Transformation Pipeline:** Dynamic image manipulation via `lib/cloudinary-url.ts`

#### **Paystack**
- **Checkout & Subscriptions:** Order payments, vendor subscription billing, wallet top-ups/withdrawals, webhook-driven settlement

#### **Shipbubble**
- **Delivery:** Live courier rates and automated dispatch for order fulfillment

#### **WhatsApp Cloud API (Meta)**
- **Buyer Bot:** Product search (text, photo, and OCR fallback), cart/checkout, order status, delivered via approved message templates with a self-healing free-text fallback

#### **Vercel Analytics**
- **Performance Monitoring:** Core Web Vitals tracking
- **User Behavior:** Page views, conversion tracking

---

## 🛡️ Security & Privacy

### **Data Protection**
- **Encryption:** All data encrypted in transit (TLS) and at rest (MongoDB Atlas)
- **Authentication:** Session cookie + JWT, bcrypt-hashed passwords
- **Authorization:** Role-based access control (RBAC), enforced per-route via `lib/server-route-auth.ts`
- **Input Validation:** Comprehensive form validation with Zod schemas

### **Privacy Compliance**
- **GDPR Ready:** Data protection and user rights
- **Cookie Management:** Consent and preference handling
- **Data Minimization:** Collect only necessary information
- **Right to Deletion:** User data removal capabilities

### **Security Features**
- **Rate Limiting:** Protection against brute force attacks
- **CSRF Protection:** Cross-site request forgery prevention
- **XSS Prevention:** Input sanitization and output encoding
- **Secure Headers:** Content Security Policy implementation

---

## 📈 Performance Optimizations

### **Frontend Performance**
- **Code Splitting:** Automatic route-based code splitting
- **Image Optimization:** Next.js image optimization
- **Lazy Loading:** Components and images load on demand
- **Bundle Analysis:** Webpack bundle analyzer integration

### **Database Performance**
- **Indexes:** Defined on Mongoose schemas, including a weighted text index for product/service search relevance
- **Connection Pooling:** Reused Mongoose connection across requests (`lib/mongodb.ts`)
- **Caching:** Redis-backed caching for hot read paths (`lib/cache-store.ts`) plus Next.js route-level cache headers
- **Query Optimization:** Efficient data fetching patterns

### **Network Optimization**
- **CDN Integration:** Global content delivery
- **Compression:** Gzip/Brotli compression
- **HTTP/2:** Modern protocol support
- **Prefetching:** Preload critical resources

---

## 🧪 Testing Strategy

### **Test Structure**
- **Unit Tests:** Component and function testing
- **Integration Tests:** API and database testing
- **E2E Tests:** Full user journey testing
- **Performance Tests:** Load and stress testing

### **Test Environment**
- **Duplicate Structure:** Isolated test environment in `/test` folder
- **Mock Data:** Realistic test data sets
- **Test Coverage:** Comprehensive code coverage
- **CI/CD Integration:** Automated testing pipeline

---

## 🔄 Continuous Integration/Deployment

### **Deployment Pipeline**
1. **Code Commit:** Push to repository
2. **Vercel Build:** Automatic build + preview deployment per branch/PR
3. **Production Deploy:** Merges to `main` deploy to production on Vercel

### **Environment Management**
- **Development:** Local development environment
- **Staging:** Testing and preview environment
- **Production:** Live application environment
- **Feature Branches:** Isolated feature development

---

## 📋 Project Status

This section previously listed an aspirational feature roadmap that had drifted well out of sync with the actual codebase (it still described Firebase as the database and payments as "in development" long after both were replaced/shipped). Rather than re-guess a roadmap, here's what's confirmed live as of this update, based on the commit history — for anything more current, check `git log` or wherever the team tracks in-flight work:

- Multi-vendor marketplace: goods + services, vendor dashboards, admin panel
- MongoDB/Mongoose backend (migrated off Firebase Firestore)
- Custom email/password auth with role-based access control
- Paystack payments: checkout, vendor subscriptions, wallet top-ups/withdrawals
- Shipbubble live courier rates and automated delivery dispatch
- Escrow release tied to actual courier delivery confirmation
- Per-product and per-service reviews
- Wishlist price-drop notifications, abandoned cart recovery
- Redis-backed, distributed rate limiting
- WhatsApp Cloud API buyer bot: text/photo/OCR product search, cart, checkout, order status, approved message templates with a self-healing free-text fallback
- AI-powered support chat (Gemini) with ticket escalation to a real admin inbox when it can't resolve an issue

---

## 🤝 Contributing

### **Development Workflow**
1. **Fork the Repository**
2. **Create Feature Branch:** `git checkout -b feature/your-feature`
3. **Make Changes:** Follow coding standards
4. **Write Tests:** Ensure test coverage
5. **Submit Pull Request:** Detailed description of changes

### **Coding Standards**
- **TypeScript:** Strict type checking
- **ESLint:** Code quality enforcement
- **Prettier:** Consistent code formatting
- **Naming Conventions:** Clear, descriptive names
- **Documentation:** Inline and README documentation

---

## 📞 Support & Maintenance

### **Issue Tracking**
- **Bug Reports:** Detailed issue templates
- **Feature Requests:** Enhancement proposals
- **Security Issues:** Private security reporting
- **Performance Issues:** Performance optimization requests

### **Support Channels**
- **Documentation:** Comprehensive guides and references
- **Community:** Developer community support
- **Professional:** Enterprise support options
- **Training:** Developer training and onboarding

---

## 📄 License & Legal

### **License Information**
- **Code License:** [Specify license type]
- **Asset License:** [Specify asset licensing]
- **Third-party Licenses:** Listed in dependencies

### **Legal Compliance**
- **Terms of Service:** Platform usage terms
- **Privacy Policy:** Data handling practices
- **Cookie Policy:** Cookie usage and management
- **Return Policy:** Product return procedures
- **Shipping Policy:** Delivery terms and conditions

---

## 📚 Additional Resources

### **Documentation Links**
- **[MongoDB Migration Notes](./MONGODB_MIGRATION.md)** - History of the Firebase → MongoDB migration
- **[Authentication Fix Log](./AUTH_FIX_SUMMARY.md)** - Authentication troubleshooting
- **[Goods/Services Architecture](./GOODS_SERVICES_SEPARATION.md)** - Feature implementation details
- **[Issue Prevention Guide](./ISSUE_PREVENTION.md)** - Common issues and solutions
- **[Quick Fix Reference](./QUICK_FIX.md)** - Rapid problem resolution
- **[Firebase Setup Guide](./FIREBASE_SETUP.md)** - Legacy; kept for historical reference only, not the active backend

### **External Documentation**
- **[Next.js Documentation](https://nextjs.org/docs)**
- **[MongoDB Documentation](https://www.mongodb.com/docs/)**
- **[Mongoose Documentation](https://mongoosejs.com/docs/)**
- **[Tailwind CSS](https://tailwindcss.com/docs)**
- **[Radix UI](https://www.radix-ui.com/docs)**
- **[TypeScript Handbook](https://www.typescriptlang.org/docs)**

---

*Last Updated: August 7, 2026*
*Version: 0.1.0*
