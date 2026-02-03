# Existing User Migration Guide

## Overview

When implementing email verification on an existing application, you need to handle users who registered before the verification system was in place. These users will have `isEmailVerified: false` (or undefined) and won't be able to sign in.

## Solutions Implemented

### 1. 🚀 **Automatic Legacy User Detection**

The login system now automatically detects legacy users and sends them verification emails:

- When a legacy user tries to sign in, they get a friendly blue message
- The system automatically sends a verification email 
- User can then verify and sign in normally

### 2. 📧 **Migration Script** 

Run the migration script to send verification emails to all existing users:

```bash
# Send to all unverified users
node migrate-existing-users.js

# Send to specific domain
node migrate-existing-users.js @gmail.com

# Send to specific user
node migrate-existing-users.js user@example.com
```

### 3. 🎛️ **Admin Panel**

Access the admin panel at `/admin/migrate-users` to:
- Count unverified users
- Preview user list
- Run migration with filters
- Monitor success/failure rates

### 4. 🛠️ **API Endpoints**

```bash
# Count unverified users
GET /api/admin/migrate-users
Authorization: Bearer your-admin-key

# Run migration
POST /api/admin/migrate-users
{
  "action": "migrate",
  "emailFilter": "@company.com" // optional
}
```

## Migration Process

### Step 1: Assessment
```bash
# Check how many users need migration
node run-migration.js count

# Check specific domain
node run-migration.js count @gmail.com
```

### Step 2: Test Email Service
```bash
# Test that emails are working
node run-migration.js test-email
```

### Step 3: Run Migration
```bash
# Migrate all users (recommended for small lists)
node migrate-existing-users.js

# Or use the helper with confirmation
node run-migration.js migrate
```

### Step 4: Monitor & Follow Up
- Check admin panel for results
- Monitor email delivery logs
- Handle any failed email addresses
- Consider follow-up reminders after 24-48 hours

## Migration Features

### ✅ **Safety Features**
- **Batch Processing**: Processes 50 users at a time to avoid timeouts
- **Rate Limiting**: 1-second delay between emails to avoid spam filters
- **Error Handling**: Continues processing if individual emails fail
- **Duplicate Prevention**: Won't send to already verified users
- **Token Expiry**: 24-hour expiry for security

### ✅ **User Experience**
- **Automatic Detection**: Legacy users get emails automatically on login attempt
- **Clear Messaging**: Friendly blue messages instead of error alerts
- **Resend Options**: Multiple ways to request new verification emails
- **Professional Emails**: Branded verification emails with clear instructions

### ✅ **Admin Tools**
- **Progress Tracking**: Real-time success/failure counts
- **Filter Options**: Target specific domains or users
- **Batch Management**: Handle large user bases efficiently
- **Retry Logic**: Continue processing remaining users

## Example Workflows

### Small Site (< 100 users)
```bash
# 1. Check users
node run-migration.js count

# 2. Send to everyone at once
node migrate-existing-users.js

# 3. Done! Users will get emails and can verify
```

### Large Site (1000+ users)
```bash
# 1. Start with a test batch
node migrate-existing-users.js @yourdomain.com

# 2. Use admin panel for full migration
# Visit /admin/migrate-users

# 3. Monitor and run in batches
# System processes 50 at a time automatically
```

### Specific Users Only
```bash
# Company employees only
node migrate-existing-users.js @company.com

# VIP customers
node migrate-existing-users.js premium@

# Single user
node migrate-existing-users.js user@example.com
```

## Email Delivery Tips

### Before Migration
1. **Test Email Service**: Use `node run-migration.js test-email`
2. **Check SMTP Limits**: Ensure your email service can handle the volume
3. **Warm Up**: If using a new email service, start with small batches
4. **Domain Reputation**: Use a verified, trusted sending domain

### During Migration
1. **Monitor Logs**: Watch for SMTP errors or rate limiting
2. **Batch Size**: System uses 50 users per batch - can be adjusted
3. **Failed Emails**: Note failed addresses for manual follow-up
4. **Timing**: Run during business hours for better deliverability

### After Migration
1. **Check Spam Folders**: Remind users to check spam/junk
2. **Support Tickets**: Be ready for "didn't receive email" requests
3. **Analytics**: Track verification rates and follow up
4. **Cleanup**: Remove old unverified accounts after reasonable time

## Error Handling

### Common Issues & Solutions

**"Email service not configured"**
- Check SMTP settings in `.env.local`
- Verify EMAIL_HOST, EMAIL_USER, EMAIL_PASS

**"Too many emails, rate limited"**
- Increase delay between emails in migration script
- Use smaller batch sizes
- Spread migration over multiple days

**"Some emails failed to send"**
- Check failed email list in admin panel
- Manually verify problematic email addresses
- Consider alternative contact methods

**"Users not receiving emails"**
- Check spam folders
- Verify email addresses in database
- Test with different email providers

## Configuration

### Environment Variables
```bash
# Required for email sending
EMAIL_HOST=smtp.privateemail.com
EMAIL_USER=noreply@yourdomain.com
EMAIL_PASS=your-password

# Required for verification links
NEXTAUTH_URL=https://yourdomain.com

# Optional admin API key
ADMIN_API_KEY=your-secure-admin-key
```

### Admin API Key
Set a secure admin key in production:
```bash
ADMIN_API_KEY=your-very-secure-random-key
```

Use in API calls:
```bash
curl -H "Authorization: Bearer your-very-secure-random-key" \
  https://yourdomain.com/api/admin/migrate-users
```

## Best Practices

### 🎯 **Communication**
- Announce the email verification requirement to users
- Send a general notification about the change
- Provide clear instructions and support contact

### 🔒 **Security**
- Use HTTPS for all verification links
- Set reasonable token expiry (24 hours)
- Log migration activities for audit
- Secure admin endpoints properly

### 📊 **Monitoring**
- Track verification completion rates
- Monitor email bounce rates
- Watch for spam complaints
- Measure user satisfaction

### 🚀 **Performance**
- Run migrations during low-traffic hours
- Use appropriate batch sizes
- Monitor server resources
- Implement retry logic for failures

## FAQ

**Q: Will existing users lose access to their accounts?**
A: Temporarily, until they verify their email. The system helps them automatically.

**Q: What happens if a user doesn't verify their email?**
A: They can't sign in, but can request new verification emails anytime.

**Q: Can I migrate users gradually?**
A: Yes! Use email filters to target specific groups or domains.

**Q: What if my email service has sending limits?**
A: The system processes 50 users at a time. You can run multiple batches.

**Q: How do I know if the migration worked?**
A: Check the admin panel for success/failure counts and monitor user verifications.

**Q: Can users still create accounts during migration?**
A: Yes! New signups automatically get verification emails.

**Q: What about users with invalid email addresses?**
A: They'll show up in the failed emails list. Handle these manually or remove them.

## Support

If you encounter issues:

1. Check email service logs
2. Verify SMTP configuration  
3. Test with a single user first
4. Use the admin panel to monitor progress
5. Check the failed emails list for patterns

The system is designed to be robust and handle most scenarios gracefully. Users will have multiple opportunities to verify their accounts through automatic detection, resend options, and admin tools.