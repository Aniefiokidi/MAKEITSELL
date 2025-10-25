# Issue Prevention & Quality Checklist

## ✅ Resolved Issues

### 1. **Firestore Undefined Field Error**
**Issue**: `Unsupported field value: undefined (found in field duration)`

**Solution Applied**:
- Modified `app/vendor/services/new/page.tsx` (lines 103-135)
- Changed from: `duration: formData.duration ? parseInt(formData.duration) : undefined`
- Changed to: Conditionally add duration only if value exists
```typescript
// Only add duration if it's provided
if (formData.duration) {
  serviceData.duration = parseInt(formData.duration)
}
```

**Prevention**: Never assign `undefined` to Firestore document fields. Either:
- Omit the field entirely
- Use conditional object spreading
- Set a default value

---

### 2. **Missing Firestore Indexes**
**Issue**: `The query requires an index`

**Solution Applied**:
- Created `firestore.indexes.json` with all composite indexes
- Includes indexes for: services, products, bookings, orders, conversations
- Deploy with: `firebase deploy --only firestore:indexes`

**Prevention**: 
- Create indexes for any query combining `where()` + `orderBy()`
- Test all queries in development before production
- Use Firebase emulator for local testing

---

## 🔍 Code Quality Standards

### Firestore Document Creation
✅ **DO**:
```typescript
const data: any = {
  requiredField1: value1,
  requiredField2: value2,
}

// Only add optional fields if they exist
if (optionalValue) {
  data.optionalField = optionalValue
}

await addDoc(collection(db, "collectionName"), data)
```

❌ **DON'T**:
```typescript
await addDoc(collection(db, "collectionName"), {
  requiredField: value,
  optionalField: someValue ? someValue : undefined  // WRONG!
})
```

---

### Query Optimization
✅ **DO**:
```typescript
// Create composite index for this query
let q = query(
  collection(db, "services"),
  where("providerId", "==", userId),
  orderBy("createdAt", "desc")
)
```

❌ **DON'T**:
```typescript
// This will fail without index
let q = query(
  collection(db, "services"),
  where("field1", "==", value1),
  where("field2", "==", value2),
  orderBy("createdAt", "desc")
)
// Create index first!
```

---

### Type Safety
✅ **DO**:
```typescript
interface MyData {
  required: string
  optional?: number  // Mark as optional
}

const createData = (data: MyData) => {
  const docData: any = { required: data.required }
  if (data.optional !== undefined) {
    docData.optional = data.optional
  }
  return addDoc(collection(db, "collection"), docData)
}
```

❌ **DON'T**:
```typescript
const createData = (data: any) => {
  return addDoc(collection(db, "collection"), data)  // No validation!
}
```

---

## 🧪 Testing Checklist

### Before Creating Any Service/Product/Booking

1. **Check Required Fields**:
   - [ ] All required fields have values
   - [ ] No undefined values in payload
   - [ ] Optional fields conditionally added

2. **Verify Data Types**:
   - [ ] Numbers are parsed (parseInt/parseFloat)
   - [ ] Dates are Timestamp objects
   - [ ] Arrays have default empty array []
   - [ ] Booleans are true/false, not undefined

3. **Check Firestore Rules**:
   - [ ] User is authenticated
   - [ ] User has correct role (vendor/admin)
   - [ ] Document fields match security rules

4. **Verify Indexes**:
   - [ ] Composite indexes exist for complex queries
   - [ ] Indexes are built (not still building)
   - [ ] Query works in Firebase Console first

---

## 📋 Common Patterns

### Creating Documents with Optional Fields

```typescript
// Pattern 1: Conditional Object Spreading
const baseData = {
  required1: value1,
  required2: value2,
}

const optionalData = {
  ...(optionalValue && { optionalField: optionalValue }),
  ...(anotherOptional && { anotherField: anotherOptional }),
}

await addDoc(collection(db, "coll"), { ...baseData, ...optionalData })
```

```typescript
// Pattern 2: Building Object Incrementally
const data: any = { required: value }

if (optional1) data.optional1 = optional1
if (optional2) data.optional2 = optional2

await addDoc(collection(db, "coll"), data)
```

```typescript
// Pattern 3: Filter Undefined Values
const rawData = {
  required: value,
  optional1: maybeUndefined,
  optional2: alsoMaybeUndefined,
}

const cleanData = Object.fromEntries(
  Object.entries(rawData).filter(([_, v]) => v !== undefined)
)

await addDoc(collection(db, "coll"), cleanData)
```

---

## 🚨 Error Handling

### Firestore Errors to Watch For

1. **"Unsupported field value: undefined"**
   - Cause: Passing undefined to document field
   - Fix: Conditionally add field or use default value

2. **"The query requires an index"**
   - Cause: Complex query without composite index
   - Fix: Create index via Firebase Console or firestore.indexes.json

3. **"Missing or insufficient permissions"**
   - Cause: Firestore security rules block access
   - Fix: Deploy correct rules with firebase deploy --only firestore:rules

4. **"Document does not exist"**
   - Cause: Trying to read/update non-existent document
   - Fix: Check if document exists before operations

---

## 🔐 Security Best Practices

### Firestore Rules
```javascript
// Good: Check ownership
allow update: if request.auth.uid == resource.data.vendorId;

// Good: Validate data structure
allow create: if request.resource.data.price is number 
              && request.resource.data.title is string;

// Bad: Too permissive
allow write: if true;  // DON'T DO THIS
```

### Data Validation
```typescript
// Good: Validate before saving
if (!formData.title || !formData.price) {
  throw new Error("Missing required fields")
}

if (formData.price < 0) {
  throw new Error("Price must be positive")
}

await createService(validatedData)
```

---

## 📊 Monitoring & Debugging

### Check Index Status
```bash
firebase firestore:indexes
```

### Test Queries in Firebase Console
1. Go to Firestore Console
2. Select collection
3. Click "Filter" or "Order by"
4. Verify query works before coding

### Enable Firestore Debug Logging
```typescript
// In development only
if (process.env.NODE_ENV === 'development') {
  enableIndexedDbPersistence(db).catch((err) => {
    console.error('Persistence error:', err)
  })
}
```

---

## ✅ Pre-Deployment Checklist

- [ ] All Firestore indexes deployed
- [ ] Security rules deployed and tested
- [ ] All forms validated (no undefined values)
- [ ] Image upload limits enforced (5MB max)
- [ ] All queries tested with real data
- [ ] Error boundaries in place
- [ ] Loading states for async operations
- [ ] Toast notifications for user feedback
- [ ] Mobile responsiveness verified
- [ ] Authentication flows tested
- [ ] Vendor type separation working
- [ ] Dashboard tabs rendering correctly

---

## 🐛 Known Issues (All Fixed)

1. ✅ Duration field undefined - **FIXED**
2. ✅ Missing composite indexes - **FIXED** (firestore.indexes.json created)
3. ✅ Vendor type not persisting - **FIXED** (SignupForm updated)
4. ✅ Sidebar not filtering by vendor type - **FIXED** (VendorSidebar updated)
5. ✅ Service image limit too low - **FIXED** (increased to 10)

---

## 📝 Future Improvements

- [ ] Add form validation library (Zod/Yup)
- [ ] Implement optimistic updates
- [ ] Add offline support with Firestore persistence
- [ ] Create automated tests for critical paths
- [ ] Add performance monitoring
- [ ] Implement data migration scripts
- [ ] Add backup/restore functionality

---

**Last Updated**: October 23, 2025
**Status**: All current issues resolved ✅
