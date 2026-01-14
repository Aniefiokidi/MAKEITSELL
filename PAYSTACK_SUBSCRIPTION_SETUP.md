# Paystack Recurring Subscription Setup Guide

## Overview
Your vendor subscription is now configured for **automatic monthly recurring billing** using Paystack Subscriptions API. Vendors pay ₦2,500/month, and Paystack handles all recurring charges automatically.

## How It Works

1. **First Payment**: Vendor signs up and pays ₦2,500
2. **Subscription Created**: Paystack automatically creates a subscription
3. **Monthly Billing**: Paystack charges the vendor ₦2,500 every month automatically
4. **Card Storage**: Paystack securely stores card details (PCI-compliant)
5. **Notifications**: Vendors receive email before each charge
6. **Management**: Vendors can cancel/update subscriptions via Paystack links

## Setup Instructions

### Step 1: Create Subscription Plan (One-Time Setup)

You need to create a subscription plan on your Paystack dashboard. You have two options:

#### Option A: Via Paystack Dashboard (Recommended)
1. Log in to [Paystack Dashboard](https://dashboard.paystack.com/)
2. Go to **Settings** → **Payment Pages** → **Plans**
3. Click **Create Plan**
4. Fill in:
   - **Plan Name**: Vendor Monthly Subscription
   - **Amount**: 2500 (₦2,500)
   - **Interval**: Monthly
   - **Description**: Monthly subscription for vendors on Make It Sell marketplace
5. Click **Save**
6. Copy the **Plan Code** (starts with `PLN_`)

#### Option B: Via API
Run this command to create the plan automatically:

```bash
curl -X POST http://localhost:3000/api/subscriptions/plans \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Vendor Monthly Subscription",
    "amount": 2500,
    "interval": "monthly",
    "description": "Monthly subscription for vendors on Make It Sell marketplace"
  }'
```

This will return a `plan_code` like `PLN_xxxxxxxxxxxxx`

### Step 2: Add Plan Code to Environment Variables

Add the plan code to your `.env.local` file:

```env
PAYSTACK_VENDOR_PLAN_CODE=PLN_xxxxxxxxxxxxx
```

Replace `PLN_xxxxxxxxxxxxx` with your actual plan code.

### Step 3: Redeploy

If you're using Vercel or another platform:
1. Add the environment variable to your production environment
2. Redeploy your application

## What Happens During Signup

1. **Vendor registers** and fills signup form
2. **Payment initiated** with subscription plan linked
3. **Vendor pays** ₦2,500 via Paystack
4. **Subscription automatically created** by Paystack
5. **Vendor account activated** with subscription details stored
6. **Monthly charges begin** automatically on the same date each month

## Subscription Management

### Check Subscription Status
```javascript
const result = await paystackService.getSubscription(subscriptionCode)
```

### Cancel Subscription
```javascript
const result = await paystackService.cancelSubscription(subscriptionCode, emailToken)
```

### Webhooks
Paystack sends webhooks for:
- `subscription.create` - When subscription is created
- `subscription.disable` - When subscription is cancelled
- `charge.success` - When monthly charge succeeds
- `charge.failed` - When monthly charge fails

## Database Schema

Store these fields for each vendor:

```javascript
{
  subscriptionCode: String, // From Paystack
  subscriptionStatus: String, // active, cancelled, failed
  subscriptionPlan: String, // Plan code
  nextBillingDate: Date,
  lastBillingDate: Date,
  subscriptionStartDate: Date,
  authorizationCode: String // For manual charges if needed
}
```

## Testing

### Test Mode
1. Use test API keys from Paystack
2. Test cards: `4084084084084081` (successful) or `4084084084084084` (declined)
3. Test subscriptions will be created but no real charges

### Live Mode
1. Switch to live API keys
2. Real charges will occur monthly
3. Monitor your Paystack dashboard for subscriptions

## Important Notes

✅ **Automatic Retries**: Paystack automatically retries failed payments for 3 days
✅ **Email Notifications**: Vendors receive emails before charges and for failed payments
✅ **PCI Compliance**: Paystack handles all card storage securely
✅ **No Manual Work**: Everything is automatic once set up
✅ **Customer Portal**: Vendors can manage subscriptions via Paystack links

❌ **Don't Store Cards**: Never try to store card details yourself
❌ **Don't Charge Manually**: Let Paystack handle recurring charges
❌ **Don't Skip Webhooks**: Always implement webhook handlers for subscription events

## Monitoring

Monitor subscriptions in your Paystack dashboard:
- Active subscriptions count
- Failed payment alerts
- Churn metrics
- Revenue tracking

## Support

If vendors have subscription issues:
1. Check Paystack dashboard for subscription status
2. Use subscription code to query details via API
3. Send manage subscription link: `https://dashboard.paystack.com/subscriptions/{subscription_code}`

## Migration from One-Time Payments

If you have existing vendors with one-time payments:
1. Contact them about the subscription change
2. They'll need to sign up for the subscription
3. Or manually create subscriptions using their stored authorization codes

## Next Steps

1. ✅ Create subscription plan on Paystack
2. ✅ Add `PAYSTACK_VENDOR_PLAN_CODE` to environment
3. ✅ Deploy/restart application
4. ✅ Test signup flow with test card
5. ✅ Implement webhook handlers for subscription events
6. ✅ Add subscription management UI for vendors
7. ✅ Monitor first successful recurring charge

Your recurring subscription system is now ready! 🎉
