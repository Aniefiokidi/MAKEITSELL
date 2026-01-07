📧 EMAIL SETUP GUIDE 
====================

## To Fix the Email Error

Your email system is ready! You just need to configure your email credentials. Here are your options:

## 📌 OPTION 1: Gmail (RECOMMENDED)

### Step 1: Use Gmail App Password (Most Secure)

1. **Go to Google Account Settings**
   - Visit: https://myaccount.google.com/security
   - Make sure 2-Factor Authentication is enabled

2. **Generate App Password**
   - Click "App passwords"
   - Select "Mail" and "Other (custom name)"
   - Enter "Make It Sell" as the name
   - Copy the 16-character password (e.g., `abcd efgh ijkl mnop`)

3. **Update Your .env.local File**
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=youremail@gmail.com
   SMTP_PASS=abcdefghijklmnop    # The 16-character app password
   SMTP_FROM_EMAIL=youremail@gmail.com
   SMTP_FROM_NAME=Make It Sell
   ```

4. **Test the Email**
   - Restart your Next.js server: `pnpm dev`
   - Make a test purchase to trigger the email

---

## 📌 OPTION 2: Outlook/Hotmail

```
SMTP_HOST=smtp.live.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=youremail@outlook.com
SMTP_PASS=your-regular-password
SMTP_FROM_EMAIL=youremail@outlook.com
SMTP_FROM_NAME=GoTE Marketplace
```

---

## 📌 OPTION 3: Business Email (If You Have One)

If you have a business domain (like `yourcompany.com`):

```
SMTP_HOST=mail.yourcompany.com    # Check with your host
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@yourcompany.com
SMTP_PASS=your-email-password
SMTP_FROM_EMAIL=noreply@yourcompany.com
SMTP_FROM_NAME=GoTE Marketplace
```

---

## 🎯 What Your Customers Will Receive

✅ **Professional invoice-style emails** with:
- Order confirmation with invoice number
- Product details and images
- Delivery estimate (1-5 business days)
- Payment confirmation
- Your marketplace branding

✅ **Vendors will receive**:
- New order notifications
- Customer contact information
- Items to ship
- Delivery deadlines
- Direct link to order dashboard

---

## 🛠 Quick Test Commands

After setting up your email, test it:

```bash
# Restart your server
pnpm dev

# Or create a test script (optional)
node test-email.js
```

---

## ❌ Troubleshooting

If you still get errors:

1. **Double-check credentials** - Make sure email/password are correct
2. **Gmail**: Must use App Password, not regular password
3. **Firewall**: Your hosting provider might block SMTP ports
4. **Alternative**: Consider using services like SendGrid, Mailgun, or Resend for production

---

## 💡 Pro Tips

- Use a dedicated email like `noreply@yourmarketplace.com` for professional look
- Gmail is free and reliable for testing and small scale
- For high volume, consider transactional email services
- The emails will automatically include delivery estimates and professional formatting

**Your email system is already built and ready to go! Just add your credentials and it will start working immediately.**