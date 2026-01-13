# Login Issue Fix - Password Hash Problem

## Problem
Users cannot log in because their accounts were created without properly storing password hashes in the database. When login is attempted, the system logs show:
```
[auth.signIn] Stored hash: undefined
[auth.signIn] Hashes match: false
```

## Root Cause
Existing user accounts have `passwordHash: undefined` in the MongoDB database. This typically happens when users were created before the password hashing system was fully implemented, or via a data import that didn't include hashes.

## Solution Overview

### For End Users
Users affected by this issue should use the **Forgot Password** feature to reset their passwords.

1. Go to `/forgot-password` or click "Forgot password?" on the login page
2. Enter their email address
3. They will receive a password reset token
4. Enter the token and set a new password
5. They can then log in with their new password

### For Administrators
To fix all users at once, there are two approaches:

#### Option 1: Manual Fix via API (Easiest)
1. Start the development server: `npm run dev`
2. Call this endpoint in PowerShell:
```powershell
$headers = @{
    'Authorization' = 'Bearer dev-secret'
    'Content-Type' = 'application/json'
}
$response = Invoke-WebRequest -Uri 'http://localhost:3001/api/admin/fix-auth' `
    -Method POST `
    -Headers $headers `
    -Body '{}'
$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

This will:
- Find all users with undefined passwordHash
- Generate temporary passwords for each
- Allow them to log in and reset via forgot password

#### Option 2: Using MongoDB Directly
1. Connect to MongoDB using MongoDB Compass or command line
2. Find the User collection
3. For each user, update the passwordHash field with a temporary hash

```bash
# Example: Generate a temporary password hash
# SHA256("temp123456") = 9f86d081884c7d6d9ffd60bb51d3378df689a2c19fa42e8f4e6b47e50f3eb87
```

## New Files Created

### 1. Forgot Password Page
**File**: `app/forgot-password/page.tsx`
- User-friendly interface for password reset
- Two-step process: email verification → password reset
- Shows reset token in development mode for easy testing
- Handles token validation and password updates

### 2. Forgot Password API
**File**: `app/api/auth/forgot-password/route.ts`
- Handles password reset requests
- Generates secure reset tokens (24-hour expiry)
- Validates tokens before allowing password changes
- Stores new password hash in database

### 3. Admin Fix Endpoint
**File**: `app/api/admin/fix-auth/route.ts`
- Fixes users with missing password hashes
- Protected with `Authorization: Bearer dev-secret`
- Generates temporary passwords
- Can be called via API to fix all users at once

### 4. Migration Script (Optional)
**File**: `scripts/fix-password-hashes.js`
- Node.js script for batch fixing password hashes
- Useful for automated deployments
- Usage: `node scripts/fix-password-hashes.js`

## Enhanced Auth Error Handling
**File**: `lib/auth.ts` (updated `signIn` function)
- Now checks if password hash is undefined
- Provides helpful error message directing users to forgot password
- Logs detailed information for debugging

## Testing the Fix

### Step 1: Start the Development Server
```bash
npm run dev
```

### Step 2: Test Forgot Password Flow
1. Navigate to `http://localhost:3001/forgot-password`
2. Enter an existing user's email
3. Copy the reset token from the success message
4. Enter the token and new password
5. Log in with the new password

### Step 3: Verify Login Works
1. Go to `http://localhost:3001/login`
2. Enter the email and new password
3. Should successfully log in

## For Production Deployment

1. **Remove Dev Token Visibility**: Comment out the token return in `app/api/auth/forgot-password/route.ts`:
```typescript
// For production, remove this line:
token: process.env.NODE_ENV === 'development' ? token : undefined,
```

2. **Set Strong Admin Secret**: In production, change the admin secret:
```bash
ADMIN_SECRET=your-strong-secret-here
```

3. **Implement Email Sending**: Currently, the reset token is shown in the response. In production, implement actual email sending:
```typescript
// Add email service to forgot-password endpoint
await sendPasswordResetEmail(email, token);
```

4. **Fix All Existing Users**: Before going live, run the admin fix endpoint to ensure all existing users have password hashes.

## Security Notes

✅ **Implemented**:
- SHA256 password hashing
- Secure reset tokens (32 random bytes)
- Token expiration (24 hours)
- Protected admin endpoint with bearer token

⚠️ **To Improve in Production**:
- Implement actual email sending for reset tokens
- Remove token from API response (use email instead)
- Use stronger password hashing (bcrypt recommended)
- Implement rate limiting on password reset endpoints
- Add audit logging for authentication events

## Environment Variables Needed

```
ADMIN_SECRET=dev-secret  # Change in production
MONGODB_URI=...          # Already configured
```

## Rollback Instructions

If something goes wrong:

1. Check the error logs in the browser console or server logs
2. Manually verify the password hash using MongoDB:
```javascript
db.users.findOne({ email: "user@example.com" }, { passwordHash: 1 })
```

3. If hashes are corrupted, restore from backup or have users reset via forgot password

## Support

Users experiencing login issues should:
1. Try the "Forgot password?" link on the login page
2. Follow the password reset process
3. Contact support if they don't receive the reset token

For technical support, check:
- Server logs for authentication errors
- MongoDB user collection for password hash status
- Browser developer console for network errors
