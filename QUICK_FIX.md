# Quick Fix Reference - Firestore Issues

## 🚀 Immediate Actions Required

### 1. Deploy Firestore Indexes (REQUIRED)
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Deploy indexes
firebase deploy --only firestore:indexes

# Check status
firebase firestore:indexes
```

**OR** Click the error link in your console to create indexes one by one.

---

## ✅ Issues Fixed in Code

### Issue 1: "Unsupported field value: undefined"
**File**: `app/vendor/services/new/page.tsx`
**Lines**: 103-135

**What was fixed**:
```typescript
// BEFORE (WRONG):
const serviceData = {
  duration: formData.duration ? parseInt(formData.duration) : undefined,
  // ... other fields
}

// AFTER (CORRECT):
const serviceData: any = {
  // ... all required fields
}

// Only add duration if it's provided
if (formData.duration) {
  serviceData.duration = parseInt(formData.duration)
}
```

**Why it works**: Firestore doesn't accept `undefined` values. We either include the field with a value, or omit it entirely.

---

### Issue 2: "The query requires an index"
**File**: `firestore.indexes.json` (CREATED)

**What was created**:
- 11 composite indexes for all query combinations
- Services: providerId+createdAt, category+createdAt, featured+createdAt, locationType+createdAt
- Products: vendorId+createdAt
- Bookings: providerId+bookingDate, customerId+bookingDate, providerId+status+bookingDate
- Orders: vendorId+createdAt
- Conversations: customerId+lastMessageTime, providerId+lastMessageTime

**How to deploy**: `firebase deploy --only firestore:indexes`

---

## 📋 Files Created

1. **firestore.indexes.json** - All composite indexes
2. **firestore.rules** - Security rules for all collections
3. **FIREBASE_SETUP.md** - Complete deployment guide
4. **ISSUE_PREVENTION.md** - Coding standards and best practices
5. **firebase-scripts.json** - Helper npm scripts

---

## 🔍 How to Test

### Test Service Creation
1. Go to `/vendor/services/new`
2. Fill in all required fields
3. Leave "Duration" empty or fill it
4. Upload 5-10 images
5. Click "Create Service"
6. Should succeed without errors

### Test Index Deployment
1. Run: `firebase deploy --only firestore:indexes`
2. Wait 2-5 minutes
3. Run: `firebase firestore:indexes`
4. Should show: "✓ All indexes built successfully"

### Test Vendor Types
1. Register as vendor
2. Select "Goods Only" / "Services Only" / "Both"
3. Check sidebar shows correct sections
4. Check dashboard shows correct tabs/metrics

---

## 🐛 If You Still See Errors

### "The query requires an index"
1. Click the link in the error message
2. OR run: `firebase deploy --only firestore:indexes`
3. Wait for indexes to build (2-10 mins)

### "Unsupported field value: undefined"
- Check the file creating the document
- Look for: `fieldName: value ? value : undefined`
- Change to: `if (value) obj.fieldName = value`

### "Permission denied"
1. Deploy rules: `firebase deploy --only firestore:rules`
2. Check user is authenticated
3. Verify user has correct role

---

## 📊 Index Build Times

| Collection | Records | Build Time |
|------------|---------|------------|
| < 100 | 2 mins |
| 100-1000 | 5 mins |
| > 1000 | 10+ mins |

---

## ✅ Verification Checklist

After deploying indexes, verify:

- [ ] Can create service without duration field
- [ ] Can create service with duration field
- [ ] Vendor dashboard loads without errors
- [ ] Services list loads for vendor
- [ ] Bookings page loads
- [ ] No console errors for missing indexes
- [ ] All vendor types work (goods/services/both)

---

## 🆘 Emergency Rollback

If something breaks:

```bash
# Revert to previous firestore rules
firebase deploy --only firestore:rules

# Delete problematic index
# Go to Firebase Console > Firestore > Indexes > Delete

# Clear Next.js cache
rm -rf .next
npm run dev
```

---

## 📞 Support

**Error**: "The query requires an index"
**Solution**: Deploy indexes with `firebase deploy --only firestore:indexes`

**Error**: "Unsupported field value: undefined"  
**Solution**: Already fixed in `app/vendor/services/new/page.tsx`

**Error**: "Permission denied"
**Solution**: Deploy rules with `firebase deploy --only firestore:rules`

---

**Status**: All code fixes applied ✅  
**Next Step**: Deploy Firestore indexes to Firebase  
**Command**: `firebase deploy --only firestore:indexes`
