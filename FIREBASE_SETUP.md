# Firebase Setup & Deployment Guide

## 🔥 Firestore Indexes Setup

The application requires composite indexes for optimal query performance. Follow these steps:

### Option 1: Automatic Index Creation (Recommended)

1. **Click the index creation link** when you see the error in the console
2. The link will look like: `https://console.firebase.google.com/v1/r/project/gote-ecommerce/firestore/indexes?create_composite=...`
3. Click "Create Index" in the Firebase Console
4. Wait 2-5 minutes for the index to build

### Option 2: Deploy All Indexes at Once

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Initialize Firebase in your project** (if not already done):
   ```bash
   firebase init firestore
   ```
   - Select your project: `gote-ecommerce`
   - Use existing `firestore.rules`
   - Use existing `firestore.indexes.json`

4. **Deploy indexes**:
   ```bash
   firebase deploy --only firestore:indexes
   ```

5. **Deploy security rules**:
   ```bash
   firebase deploy --only firestore:rules
   ```

---

## 📋 Required Indexes

The `firestore.indexes.json` file includes all necessary composite indexes:

### Services Collection
- `providerId + createdAt` - For vendor's services list
- `category + createdAt` - For category filtering
- `featured + createdAt` - For featured services
- `locationType + createdAt` - For location filtering

### Products Collection
- `vendorId + createdAt` - For vendor's products list

### Bookings Collection
- `providerId + bookingDate` - For vendor's bookings
- `customerId + bookingDate` - For customer's bookings
- `providerId + status + bookingDate` - For filtered bookings

### Orders Collection
- `vendorId + createdAt` - For vendor's orders

### Conversations Collection
- `customerId + lastMessageTime` - For customer's messages
- `providerId + lastMessageTime` - For vendor's messages

---

## 🔐 Security Rules

The `firestore.rules` file includes comprehensive security:

- ✅ **Public read** for products, services, reviews
- ✅ **Authenticated write** for bookings, orders, messages
- ✅ **Owner-only** updates for user profiles, vendor content
- ✅ **Admin privileges** for all operations
- ✅ **Privacy protection** for conversations and orders

---

## 🚀 Development Workflow

### 1. Start Development Server
```bash
npm run dev
```

### 2. First-Time Setup Checklist
- [ ] Create Firebase project at https://console.firebase.google.com
- [ ] Enable Authentication (Email/Password)
- [ ] Create Firestore Database
- [ ] Deploy indexes: `firebase deploy --only firestore:indexes`
- [ ] Deploy security rules: `firebase deploy --only firestore:rules`
- [ ] Set up Cloudinary account for image uploads
- [ ] Add environment variables to `.env.local`

### 3. Environment Variables Required
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=gote-ecommerce
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=my_unsigned_preset
```

---

## 🐛 Common Issues & Fixes

### Issue: "The query requires an index"
**Solution**: 
1. Click the provided link to create the index
2. OR run `firebase deploy --only firestore:indexes`

### Issue: "Unsupported field value: undefined"
**Solution**: 
- Fixed in `app/vendor/services/new/page.tsx`
- All optional fields are now conditionally added
- Duration field only added if value is provided

### Issue: "Permission denied"
**Solution**: 
1. Deploy security rules: `firebase deploy --only firestore:rules`
2. Ensure user is authenticated
3. Verify user role matches required permissions

### Issue: Images not uploading
**Solution**: 
1. Check Cloudinary credentials in `.env.local`
2. Verify upload preset exists and is unsigned
3. Check file size (max 5MB per image)

---

## 📊 Data Structure

### User Profile
```typescript
{
  uid: string
  email: string
  displayName: string
  role: "customer" | "vendor" | "admin" | "csa"
  vendorType?: "goods" | "services" | "both"  // NEW
  createdAt: Date
  updatedAt: Date
}
```

### Service Document
```typescript
{
  providerId: string
  title: string
  description: string
  category: string
  price: number
  pricingType: "fixed" | "hourly" | "per-session" | "custom"
  duration?: number  // optional - in minutes
  images: string[]  // 5-10 portfolio images
  location: string
  locationType: "online" | "in-person" | "both"
  availability: { [day]: { start, end, available } }
  status: "active" | "inactive" | "paused"
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

## ✅ Testing Checklist

### Vendor Registration
- [ ] Select vendor type (goods/services/both)
- [ ] See correct helper text based on selection
- [ ] vendorType saved to Firestore
- [ ] Dashboard shows correct sections

### Services Dashboard (vendorType: "services")
- [ ] See only Services & Bookings in sidebar
- [ ] "Add Service" button visible
- [ ] No Products/Orders sections
- [ ] Can create service with 5-10 images
- [ ] Dashboard shows service metrics

### Goods Dashboard (vendorType: "goods")
- [ ] See only Products & Orders in sidebar
- [ ] "Add Product" button visible
- [ ] No Services/Bookings sections
- [ ] Dashboard shows product metrics

### Both Dashboard (vendorType: "both")
- [ ] See tabbed interface
- [ ] "My Goods" tab shows products/orders
- [ ] "My Services" tab shows services/bookings
- [ ] Both "Add Product" and "Add Service" buttons visible
- [ ] Sidebar has grouped sections with emoji headers

---

## 🔄 Index Build Status

After deploying indexes, check status:
```bash
firebase firestore:indexes
```

Expected output:
```
✓ All indexes built successfully
```

Build time: 2-10 minutes depending on existing data

---

## 📞 Support

For issues:
1. Check console errors
2. Verify Firebase configuration
3. Ensure all indexes are built
4. Check security rules match user roles

---

**Last Updated**: October 23, 2025
**Project**: Branda Marketplace (Gote)
**Firebase Project**: gote-ecommerce
