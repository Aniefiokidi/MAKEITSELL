# Vendor Dashboard Mobile View Fixes

## Changes Required

### 1. VendorLayout Header (components/vendor/VendorLayout.tsx)
**Line 104-117**: Make "Add Product" button icon-only on mobile

```tsx
// REPLACE THIS:
<div className="flex items-center space-x-4">
  <Button asChild variant="outline" className="hover:bg-accent hover:scale-105 transition-all hover:shadow-lg">
    <Link href="/vendor/products/new">
      <Plus className="mr-2 h-4 w-4" />
      Add Product
    </Link>
  </Button>
  <Button variant="outline" onClick={() => routes.push('/stores')}>
    <Store className="mr-2 h-4 w-4" />
    Back To home
  </Button>
</div>

// WITH THIS:
<div className="flex items-center gap-2">
  <Button asChild variant="outline" className="hover:bg-accent hover:scale-105 transition-all hover:shadow-lg" size="sm">
    <Link href="/vendor/products/new">
      <Plus className="h-4 w-4 lg:mr-2" />
      <span className="hidden lg:inline">Add Product</span>
    </Link>
  </Button>
  <Button variant="outline" onClick={() => routes.push('/stores')} size="sm" className="hidden sm:flex">
    <Store className="mr-2 h-4 w-4" />
    Back To home
  </Button>
</div>
```

**Line 119**: Add responsive padding to main
```tsx
// CHANGE:
<main className="flex-1 overflow-y-auto p-6">

// TO:
<main className="flex-1 overflow-y-auto p-4 lg:p-6">
```

### 2. Bookings Page (app/vendor/bookings/page.tsx)

**Line 209-211**: Fix page title responsiveness
```tsx
// CHANGE:
<div className="space-y-6">
  <div>
    <h1 className="text-3xl font-bold">Service Bookings</h1>
    <p className="text-muted-foreground mt-2">Manage and approve customer service appointments</p>
  </div>

// TO:
<div className="space-y-4 lg:space-y-6">
  <div>
    <h1 className="text-2xl lg:text-3xl font-bold">Service Bookings</h1>
    <p className="text-sm lg:text-base text-muted-foreground mt-2">Manage and approve customer service appointments</p>
  </div>
```

**Line 214**: Fix stats grid responsiveness
```tsx
// CHANGE:
<div className="grid grid-cols-4 gap-4">

// TO:
<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
```

**Line 216-224**: Fix each stat card (repeat for all 4 cards)
```tsx
// CHANGE:
<Card>
  <CardContent className="p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-muted-foreground">Pending</p>
        <p className="text-2xl font-bold">{pendingBookings.length}</p>
      </div>
      <Clock3 className="h-8 w-8 text-yellow-500 opacity-50" />
    </div>
  </CardContent>
</Card>

// TO:
<Card>
  <CardContent className="p-4 lg:p-6">
    <div className="flex flex-col lg:flex-row items-center lg:justify-between gap-2 text-center lg:text-left">
      <div className="flex-1">
        <p className="text-xs lg:text-sm text-muted-foreground">Pending</p>
        <p className="text-xl lg:text-2xl font-bold">{pendingBookings.length}</p>
      </div>
      <Clock3 className="h-6 w-6 lg:h-8 lg:w-8 text-yellow-500 opacity-50 flex-shrink-0" />
    </div>
  </CardContent>
</Card>
```

**Line 263-267**: Fix tabs for mobile
```tsx
// CHANGE:
<TabsList>
  <TabsTrigger value="pending">Pending ({pendingBookings.length})</TabsTrigger>
  <TabsTrigger value="confirmed">Confirmed ({confirmedBookings.length})</TabsTrigger>
  <TabsTrigger value="completed">Completed ({completedBookings.length})</TabsTrigger>
  <TabsTrigger value="cancelled">Rejected ({cancelledBookings.length})</TabsTrigger>
</TabsList>

// TO:
<TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto">
  <TabsTrigger value="pending" className="text-xs lg:text-sm py-2">Pending ({pendingBookings.length})</TabsTrigger>
  <TabsTrigger value="confirmed" className="text-xs lg:text-sm py-2">Confirmed ({confirmedBookings.length})</TabsTrigger>
  <TabsTrigger value="completed" className="text-xs lg:text-sm py-2">Completed ({completedBookings.length})</TabsTrigger>
  <TabsTrigger value="cancelled" className="text-xs lg:text-sm py-2">Rejected ({cancelledBookings.length})</TabsTrigger>
</TabsList>
```

**Line 99-106**: Fix BookingCard header
```tsx
// CHANGE:
const BookingCard = ({ booking }: { booking: Booking }) => (
  <Card className="hover:shadow-md transition-shadow">
    <CardContent className="p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-semibold text-lg">{booking.serviceName}</h3>
          <p className="text-sm text-muted-foreground">{booking.customerName || "Customer"}</p>
        </div>

// TO:
const BookingCard = ({ booking }: { booking: Booking }) => (
  <Card className="hover:shadow-md transition-shadow">
    <CardContent className="p-4 lg:p-6">
      <div className="flex justify-between items-start mb-4 gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base lg:text-lg truncate">{booking.serviceName}</h3>
          <p className="text-xs lg:text-sm text-muted-foreground truncate">{booking.customerName || "Customer"}</p>
        </div>
```

**Line 117**: Fix booking details grid
```tsx
// CHANGE:
<div className="grid grid-cols-2 gap-4 mb-4">

// TO:
<div className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-4 mb-4">
```

**Line 118-129**: Fix each detail row (all 4)
```tsx
// CHANGE:
<div className="flex items-center gap-2">
  <Calendar className="h-4 w-4 text-muted-foreground" />
  <span className="text-sm">{format(new Date(booking.bookingDate), "MMM dd, yyyy")}</span>
</div>

// TO:
<div className="flex items-center gap-2">
  <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
  <span className="text-xs lg:text-sm truncate">{format(new Date(booking.bookingDate), "MMM dd, yyyy")}</span>
</div>
```

**Line 141-143**: Fix price and buttons
```tsx
// CHANGE:
<div className="flex justify-between items-center">
  <p className="font-semibold text-lg">{booking.totalPrice.toLocaleString('en-NG')}</p>
  <div className="flex gap-2">

// TO:
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
  <p className="font-semibold text-base lg:text-lg">₦{booking.totalPrice.toLocaleString('en-NG')}</p>
  <div className="flex gap-2 w-full sm:w-auto">
```

### 3. Analytics Page (app/vendor/analytics/page.tsx)

**Line 8**: Change DollarSign to Banknote
```tsx
// CHANGE:
import { BarChart3, TrendingUp, Users, DollarSign, Package, ShoppingCart } from "lucide-react"

// TO:
import { BarChart3, TrendingUp, Users, Banknote, Package, ShoppingCart } from "lucide-react"
```

**Line 92**: Replace icon
```tsx
// CHANGE:
<DollarSign className="h-8 w-8 text-gray-400" />

// TO:
<Banknote className="h-8 w-8 text-gray-400" />
```

## Summary
- Made "Add Product" button icon-only on mobile
- Fixed bookings stats cards to center content and be responsive (2 cols on mobile, 4 on desktop)
- Fixed tabs to wrap on mobile (2x2 grid)
- Fixed booking cards with better text truncation and responsive layouts
- Changed all DollarSign icons to Banknote for naira currency
- Added responsive padding and sizing throughout
- Fixed width issues by adding flex-shrink-0, min-w-0, truncate classes
