import { sendEmail } from './email'

export interface SubscriptionNotificationData {
  vendorEmail: string
  vendorName: string
  storeName: string
  subscriptionExpiry: Date
  amount: number
  reference?: string
}

export const SubscriptionEmailService = {
  // Send confirmation email when subscription is renewed
  async sendSubscriptionConfirmation(data: SubscriptionNotificationData) {
    const subject = '✅ Subscription Renewed Successfully'
    const template = 'subscription-confirmed'
    
    await sendEmail(
      data.vendorEmail,
      subject,
      template,
      {
        vendorName: data.vendorName,
        storeName: data.storeName,
        amount: `₦${data.amount.toLocaleString()}`,
        subscriptionPeriod: `${new Date().toLocaleDateString('en-NG')} - ${data.subscriptionExpiry.toLocaleDateString('en-NG')}`,
        reference: data.reference || 'N/A',
        nextBillingDate: data.subscriptionExpiry.toLocaleDateString('en-NG')
      }
    )
  },

  // Send warning email 1 day before expiry
  async sendExpiryWarning(data: SubscriptionNotificationData) {
    const subject = '⚠️ Subscription Expires Tomorrow - Action Required'
    const template = 'subscription-expiry-warning'
    
    await sendEmail(
      data.vendorEmail,
      subject,
      template,
      {
        vendorName: data.vendorName,
        storeName: data.storeName,
        expiryDate: data.subscriptionExpiry.toLocaleDateString('en-NG'),
        amount: `₦2,500`,
        gracePeriod: '5 days',
        consequencesMessage: 'After the grace period, your store will be frozen and customers will not be able to view your products or services.'
      }
    )
  },

  // Send failed renewal notification
  async sendRenewalFailed(data: SubscriptionNotificationData & { reason: string }) {
    const subject = '❌ Subscription Renewal Failed - Immediate Action Required'
    const template = 'subscription-renewal-failed'
    
    await sendEmail(
      data.vendorEmail,
      subject,
      template,
      {
        vendorName: data.vendorName,
        storeName: data.storeName,
        failureReason: data.reason,
        amount: `₦2,500`,
        gracePeriod: '5 days',
        expiryDate: data.subscriptionExpiry.toLocaleDateString('en-NG'),
        renewalLink: `${process.env.NEXT_PUBLIC_APP_URL}/vendor/subscription`
      }
    )
  },

  // Send grace period warning
  async sendGracePeriodWarning(data: SubscriptionNotificationData & { daysRemaining: number }) {
    const subject = `🚨 Grace Period: ${data.daysRemaining} Days Until Store Freeze`
    const template = 'subscription-grace-period'
    
    await sendEmail(
      data.vendorEmail,
      subject,
      template,
      {
        vendorName: data.vendorName,
        storeName: data.storeName,
        daysRemaining: data.daysRemaining.toString(),
        amount: `₦2,500`,
        renewalLink: `${process.env.NEXT_PUBLIC_APP_URL}/vendor/subscription`,
        supportEmail: 'noreply@makeitsell.org'
      }
    )
  },

  // Send account frozen notification
  async sendAccountFrozen(data: SubscriptionNotificationData) {
    const subject = '🔒 Store Account Frozen - Subscription Overdue'
    const template = 'account-frozen'
    
    await sendEmail(
      data.vendorEmail,
      subject,
      template,
      {
        vendorName: data.vendorName,
        storeName: data.storeName,
        amount: `₦2,500`,
        renewalLink: `${process.env.NEXT_PUBLIC_APP_URL}/vendor/subscription`,
        supportEmail: 'noreply@makeitsell.org',
        message: 'Your store has been frozen due to overdue subscription payments. Customers cannot view or purchase from your store until payment is made.'
      }
    )
  },

  // Send account reactivated notification
  async sendAccountReactivated(data: SubscriptionNotificationData) {
    const subject = '🎉 Store Account Reactivated - Welcome Back!'
    const template = 'account-reactivated'
    
    await sendEmail(
      data.vendorEmail,
      subject,
      template,
      {
        vendorName: data.vendorName,
        storeName: data.storeName,
        nextBillingDate: data.subscriptionExpiry.toLocaleDateString('en-NG'),
        amount: `₦2,500`,
        message: 'Your store is now active and visible to customers again. Thank you for renewing your subscription!'
      }
    )
  }
}