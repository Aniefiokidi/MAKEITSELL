# Email Verification System

## Overview

The email verification system ensures that users have access to the email address they register with. This prevents spam accounts and ensures reliable communication.

## Features

✅ **Automatic Email Sending**: Verification emails are sent automatically when users sign up
✅ **Professional Email Templates**: Beautiful, branded email with clear instructions
✅ **Secure Token System**: Time-limited verification tokens (24-hour expiry)
✅ **Login Protection**: Unverified users cannot sign in
✅ **Resend Functionality**: Users can request new verification emails
✅ **User-Friendly UI**: Clear verification pages and status messages
✅ **Error Handling**: Graceful handling of expired/invalid tokens

## User Flow

### 1. Sign Up
- User creates account with email/password
- Account is created but marked as `isEmailVerified: false`
- Verification email is sent automatically
- User is redirected to verification notice page

### 2. Email Verification
- User receives email with verification link
- Link contains unique token: `/verify-email?token=abc123...`
- Clicking link verifies the account and redirects to login
- Token expires after 24 hours for security

### 3. Sign In
- Unverified users see error message when trying to sign in
- Error message includes "Resend Verification Email" button
- Verified users can sign in normally

## API Endpoints

### POST `/api/auth/signup`
- Creates user account
- Sends verification email
- Returns success without signing user in

### GET `/api/auth/verify-email?token=...`
- Verifies email with token
- Marks account as verified
- Returns success/error response

### POST `/api/auth/verify-email`
- Resends verification email
- Body: `{ "email": "user@example.com" }`
- Generates new token and sends new email

### POST `/api/auth/signin`
- Checks email verification before allowing sign in
- Returns error if email not verified

## Database Schema

### User Model Updates
```javascript
{
  // ... existing fields
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  emailVerificationTokenExpiry: { type: Date },
}
```

## Email Template

The verification email includes:
- Professional branding and design
- Clear call-to-action button
- Alternative text link for accessibility
- Account benefits explanation
- Support contact information
- Expiry notice (24 hours)

## Pages & Components

### `/verify-email`
- Handles token verification
- Shows success/error states
- Auto-redirects to login on success
- Provides resend functionality on error

### `/signup/verify-notice`
- Shown after successful signup
- Explains what user should do next
- Provides resend email functionality
- Links back to login/homepage

### Login Form Updates
- Shows verification success message when redirected
- Handles verification error messages
- Includes inline resend functionality

## Security Features

1. **Token Expiry**: Verification tokens expire after 24 hours
2. **One-Time Use**: Tokens are deleted after successful verification
3. **Secure Generation**: Crypto-random 32-byte tokens
4. **No Password in Email**: Emails contain only verification links
5. **Rate Limiting**: Users can resend emails but with feedback delays

## Configuration

### Environment Variables
```bash
# Email service (already configured)
EMAIL_HOST=smtp.privateemail.com
EMAIL_USER=noreply@makeitsell.org
EMAIL_PASS=your-password

# App URL for verification links
NEXTAUTH_URL=http://localhost:3000  # or your production URL
```

## Testing

### Manual Testing
1. Create new account at `/signup`
2. Check email inbox (and spam folder)
3. Click verification link
4. Try signing in before/after verification

### Automated Testing
Run the test script:
```bash
node test-email-verification.js
```

## Error Handling

### Common Scenarios
- **Email fails to send**: User can still resend later
- **Token expired**: User gets clear error message with resend option  
- **Token already used**: User gets error with resend option
- **User not found**: Generic error message for security
- **Email already verified**: Friendly message, no error

### User Messages
- ✅ "Email verified successfully!"
- ❌ "Please verify your email address before signing in"
- ⚠️ "Verification link expired - we've sent you a new one"
- 📧 "Check your email for verification instructions"

## Benefits

1. **Spam Prevention**: Ensures real email addresses
2. **Communication Reliability**: Users will receive order/account emails  
3. **Account Security**: Prevents unauthorized account creation
4. **Professional Experience**: Users expect email verification
5. **Compliance**: Meets modern web app security standards

## Future Enhancements

- [ ] Email verification for password changes
- [ ] Phone verification option
- [ ] Social login integration (Google, Facebook)
- [ ] Batch email verification reminders
- [ ] Admin panel for verification management

## Troubleshooting

### Email Not Received
1. Check spam/junk folder
2. Verify SMTP configuration
3. Check email service logs
4. Use resend functionality

### Token Issues
1. Check token expiry (24 hours)
2. Ensure user hasn't been deleted
3. Verify database connectivity
4. Check for typos in token URL

### SMTP Issues
See `NAMECHEAP_EMAIL_CHECK.md` for email service troubleshooting.