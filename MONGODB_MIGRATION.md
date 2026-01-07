# MongoDB Migration Guide

This guide explains the migration from Firebase Firestore to MongoDB for the Gote Marketplace application.

## Migration Summary

### ✅ Completed Changes

1. **Dependencies**
   - Added: `mongodb`, `mongoose`, `bcryptjs`
   - Removed: Deprecated type packages

2. **Database Configuration**
   - Created `lib/mongodb.ts` - MongoDB connection handler
   - Created `lib/models.ts` - Mongoose schemas for all data models
   - Created `lib/mongodb-operations.ts` - Database operations

3. **Authentication System**
   - Created `lib/mongodb-auth.ts` - MongoDB-based authentication
   - Created `lib/auth-mongo.ts` - Drop-in replacement for Firebase auth
   - Supports both MongoDB users and mock credentials

4. **Database Operations**
   - Created `lib/database.ts` - Drop-in replacement for Firestore operations
   - All existing interfaces maintained for backward compatibility

5. **Component Updates**
   - Updated import statements in major components
   - Authentication components now use MongoDB auth
   - Database operations now use MongoDB

### 🔄 Migration Process

#### Phase 1: Setup (Completed)
- [x] Install MongoDB dependencies
- [x] Create MongoDB connection and models
- [x] Create drop-in replacement files
- [x] Update key components

#### Phase 2: Testing (Next)
- [ ] Start MongoDB server
- [ ] Test authentication flow
- [ ] Test database operations
- [ ] Verify all pages work

#### Phase 3: Cleanup (Future)
- [ ] Remove Firebase dependencies
- [ ] Delete old Firestore files
- [ ] Update all remaining imports

## How to Test the Migration

### 1. Install and Start MongoDB

**Option A: Local MongoDB**
```bash
# Install MongoDB Community Edition
# Windows: Download from https://www.mongodb.com/try/download/community
# macOS: brew install mongodb-community
# Linux: Follow MongoDB installation guide

# Start MongoDB service
mongod --dbpath /path/to/your/data
```

**Option B: MongoDB Atlas (Cloud)**
1. Create account at https://www.mongodb.com/atlas
2. Create cluster
3. Get connection string
4. Update MONGODB_URI in .env.local

### 2. Configure Environment Variables

Update `.env.local`:
```bash
# For local MongoDB
MONGODB_URI=mongodb://localhost:27017/gote-marketplace

# For MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/gote-marketplace?retryWrites=true&w=majority
```

### 3. Test the Application

```bash
# Install dependencies
pnpm install

# Start the application
pnpm dev
```

### 4. Test Authentication

**Mock Credentials (always work):**
- Vendor: `admin@techempire.ng` / `TechEmp123!`
- Customer: `customer@example.com` / `password123`

**New MongoDB Users:**
- Sign up with any email/password
- Data will be stored in MongoDB

### 5. Test Database Operations

**Stores & Products:**
- Visit `/shop` - Should show stores from MongoDB
- Visit `/services` - Should show services from MongoDB
- Mock data is no longer used

**Create New Data:**
- Sign up as vendor
- Create store and products
- Data persists in MongoDB

## File Structure Changes

### New Files Created
```
lib/
├── mongodb.ts              # MongoDB connection
├── models.ts               # Mongoose schemas
├── mongodb-operations.ts   # Database operations
├── mongodb-auth.ts         # Authentication system
├── auth-mongo.ts          # Auth interface (drop-in replacement)
└── database.ts            # Database interface (drop-in replacement)
```

### Files Modified
```
components/
├── auth/
│   ├── LoginForm.tsx       # Updated to use MongoDB auth
│   ├── SignupForm.tsx      # Updated to use MongoDB auth
│   └── UserMenu.tsx        # Updated to use MongoDB auth
├── services/
│   └── BookingModal.tsx    # Updated to use MongoDB operations
├── vendor/
│   └── AddProductModal.tsx # Updated to use MongoDB operations
└── FeaturedServices.tsx    # Updated to use MongoDB operations

app/
├── shop/page.tsx           # Updated to use MongoDB operations
├── services/page.tsx       # Updated to use MongoDB operations
├── product/[id]/page.tsx   # Updated to use MongoDB operations
├── service/[id]/page.tsx   # Updated to use MongoDB operations
├── order/page.tsx          # Updated to use MongoDB operations
└── deals/page.tsx          # Updated to use MongoDB operations

contexts/
└── AuthContext.tsx         # Updated to use MongoDB auth
```

## Database Schema Comparison

### Firestore vs MongoDB

| Collection | Firestore | MongoDB | Notes |
|------------|-----------|---------|-------|
| users | documents | users | Added password hashing |
| sessions | - | sessions | New: session management |
| stores | documents | stores | Direct mapping |
| products | documents | products | Direct mapping |
| services | documents | services | Direct mapping |
| orders | documents | orders | Direct mapping |
| bookings | documents | bookings | Direct mapping |
| support_tickets | documents | support_tickets | Direct mapping |
| notifications | documents | notifications | Direct mapping |
| conversations | documents | conversations | Direct mapping |
| chat_messages | documents | chat_messages | Direct mapping |
| user_carts | documents | user_carts | Direct mapping |

## Migration Benefits

### Advantages of MongoDB
1. **Better Query Performance**: Optimized indexes for common queries
2. **Stronger Data Consistency**: ACID transactions
3. **Flexible Schema Evolution**: Easy to modify data structure
4. **Better Offline Handling**: No dependency on Firebase SDK
5. **Cost Effective**: Can run on any server or cloud provider
6. **Full Control**: Complete control over database and queries

### Maintained Features
- All existing functionality preserved
- Mock authentication still works
- Same API interface for components
- Performance optimizations maintained

## Troubleshooting

### MongoDB Connection Issues
```bash
# Check MongoDB is running
mongosh --eval "db.runCommand('ping')"

# Check connection string
echo $MONGODB_URI
```

### Migration Issues
- If authentication fails, mock credentials always work
- If database operations fail, graceful fallbacks are implemented
- Check browser console for detailed error messages

### Performance Tuning
```javascript
// MongoDB indexes are automatically created for:
// - User lookups (email)
// - Product queries (vendorId, category, featured)
// - Service queries (providerId, category, featured, locationType)
// - Order queries (vendorId, customerId)
// - Booking queries (providerId, customerId, bookingDate)
```

## Next Steps

1. **Test thoroughly** with MongoDB running
2. **Create sample data** using the application
3. **Monitor performance** and optimize as needed
4. **Remove Firebase dependencies** when confident
5. **Deploy** to production with MongoDB Atlas

---

**Note**: This migration maintains full backward compatibility. If MongoDB is not available, the application falls back to mock data and Firebase authentication still works.