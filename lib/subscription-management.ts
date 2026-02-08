import connectToDatabase from './mongodb'
import { SubscriptionEmailService } from './subscription-emails'

export interface VendorSubscriptionData {
  vendorId: string
  email: string
  name: string
  storeName: string
  subscriptionStatus: string
  subscriptionExpiry: Date
  accountStatus: string
  gracePeriodEnd?: Date
  lastWarningEmail?: Date
  frozen?: boolean
}

export const SubscriptionManagementService = {
  /**
   * Process subscription renewal - called when payment is successful
   */
  async processSubscriptionRenewal(vendorId: string, paymentData: any) {
    await connectToDatabase()
    const db = require('mongoose').connection.db

    const newExpiryDate = new Date()
    newExpiryDate.setMonth(newExpiryDate.getMonth() + 1) // Add 1 month

    // Update store subscription
    const storeUpdate = await db.collection('stores').updateOne(
      { vendorId: vendorId },
      {
        $set: {
          subscriptionStatus: 'active',
          subscriptionExpiry: newExpiryDate,
          accountStatus: 'active',
          isActive: true,
          frozen: false,
          suspendedAt: null,
          gracePeriodEnd: null,
          lastWarningEmail: null,
          updatedAt: new Date()
        }
      }
    )

    // Reactivate services if they were suspended
    await db.collection('services').updateMany(
      { providerId: vendorId },
      {
        $set: {
          status: 'active',
          suspendedAt: null,
          frozen: false,
          updatedAt: new Date()
        }
      }
    )

    // Get vendor details for email
    const vendor = await db.collection('users').findOne({ 
      $or: [{ _id: vendorId }, { uid: vendorId }] 
    })
    const store = await db.collection('stores').findOne({ vendorId: vendorId })

    if (vendor && store) {
      // Send confirmation email
      await SubscriptionEmailService.sendSubscriptionConfirmation({
        vendorEmail: vendor.email,
        vendorName: vendor.displayName || vendor.name,
        storeName: store.storeName,
        subscriptionExpiry: newExpiryDate,
        amount: 2500,
        reference: paymentData.reference
      })

      // If account was frozen, send reactivation email
      if (store.frozen || store.accountStatus === 'suspended') {
        await SubscriptionEmailService.sendAccountReactivated({
          vendorEmail: vendor.email,
          vendorName: vendor.displayName || vendor.name,
          storeName: store.storeName,
          subscriptionExpiry: newExpiryDate,
          amount: 2500
        })
      }
    }

    return { success: true, newExpiryDate }
  },

  /**
   * Process failed subscription renewal
   */
  async processFailedRenewal(vendorId: string, reason: string) {
    await connectToDatabase()
    const db = require('mongoose').connection.db

    const gracePeriodEnd = new Date()
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 5) // 5 day grace period

    // Update store with grace period
    await db.collection('stores').updateOne(
      { vendorId: vendorId },
      {
        $set: {
          subscriptionStatus: 'grace_period',
          gracePeriodEnd: gracePeriodEnd,
          lastRenewalFailure: new Date(),
          renewalFailureReason: reason,
          updatedAt: new Date()
        }
      }
    )

    // Get vendor details for email
    const vendor = await db.collection('users').findOne({ 
      $or: [{ _id: vendorId }, { uid: vendorId }] 
    })
    const store = await db.collection('stores').findOne({ vendorId: vendorId })

    if (vendor && store) {
      await SubscriptionEmailService.sendRenewalFailed({
        vendorEmail: vendor.email,
        vendorName: vendor.displayName || vendor.name,
        storeName: store.storeName,
        subscriptionExpiry: store.subscriptionExpiry,
        amount: 2500,
        reason: reason
      })
    }

    return { success: true, gracePeriodEnd }
  },

  /**
   * Freeze vendor account (called after grace period expires)
   */
  async freezeVendorAccount(vendorId: string) {
    await connectToDatabase()
    const db = require('mongoose').connection.db

    // Freeze store
    await db.collection('stores').updateOne(
      { vendorId: vendorId },
      {
        $set: {
          accountStatus: 'frozen',
          subscriptionStatus: 'expired',
          isActive: false,
          frozen: true,
          frozenAt: new Date(),
          updatedAt: new Date()
        }
      }
    )

    // Suspend services
    await db.collection('services').updateMany(
      { providerId: vendorId },
      {
        $set: {
          status: 'frozen',
          frozen: true,
          frozenAt: new Date(),
          updatedAt: new Date()
        }
      }
    )

    // Get vendor details for email
    const vendor = await db.collection('users').findOne({ 
      $or: [{ _id: vendorId }, { uid: vendorId }] 
    })
    const store = await db.collection('stores').findOne({ vendorId: vendorId })

    if (vendor && store) {
      await SubscriptionEmailService.sendAccountFrozen({
        vendorEmail: vendor.email,
        vendorName: vendor.displayName || vendor.name,
        storeName: store.storeName,
        subscriptionExpiry: store.subscriptionExpiry,
        amount: 2500
      })
    }

    return { success: true }
  },

  /**
   * Send daily expiry warnings (1 day before expiry)
   */
  async sendExpiryWarnings() {
    await connectToDatabase()
    const db = require('mongoose').connection.db

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const startOfTomorrow = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate())
    const endOfTomorrow = new Date(startOfTomorrow.getTime() + 24 * 60 * 60 * 1000)

    // Find stores expiring tomorrow
    const expiringStores = await db.collection('stores').find({
      subscriptionStatus: 'active',
      subscriptionExpiry: {
        $gte: startOfTomorrow,
        $lt: endOfTomorrow
      },
      lastExpiryWarning: { $ne: startOfTomorrow.toDateString() }
    }).toArray()

    for (const store of expiringStores) {
      const vendor = await db.collection('users').findOne({ 
        $or: [{ _id: store.vendorId }, { uid: store.vendorId }] 
      })

      if (vendor) {
        await SubscriptionEmailService.sendExpiryWarning({
          vendorEmail: vendor.email,
          vendorName: vendor.displayName || vendor.name,
          storeName: store.storeName,
          subscriptionExpiry: store.subscriptionExpiry,
          amount: 2500
        })

        // Mark warning as sent
        await db.collection('stores').updateOne(
          { _id: store._id },
          {
            $set: {
              lastExpiryWarning: startOfTomorrow.toDateString(),
              updatedAt: new Date()
            }
          }
        )
      }
    }

    return { processed: expiringStores.length }
  },

  /**
   * Send grace period warnings
   */
  async sendGracePeriodWarnings() {
    await connectToDatabase()
    const db = require('mongoose').connection.db

    const now = new Date()

    // Find stores in grace period
    const gracePeriodStores = await db.collection('stores').find({
      subscriptionStatus: 'grace_period',
      gracePeriodEnd: { $gt: now }
    }).toArray()

    for (const store of gracePeriodStores) {
      const daysRemaining = Math.ceil((store.gracePeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      
      // Send daily reminders during grace period
      const lastGraceWarning = store.lastGraceWarning || new Date(0)
      const hoursSinceLastWarning = Math.abs(now.getTime() - lastGraceWarning.getTime()) / (60 * 60 * 1000)
      
      if (hoursSinceLastWarning >= 24) { // Send daily
        const vendor = await db.collection('users').findOne({ 
          $or: [{ _id: store.vendorId }, { uid: store.vendorId }] 
        })

        if (vendor) {
          await SubscriptionEmailService.sendGracePeriodWarning({
            vendorEmail: vendor.email,
            vendorName: vendor.displayName || vendor.name,
            storeName: store.storeName,
            subscriptionExpiry: store.subscriptionExpiry,
            amount: 2500,
            daysRemaining
          })

          // Update last warning time
          await db.collection('stores').updateOne(
            { _id: store._id },
            {
              $set: {
                lastGraceWarning: now,
                updatedAt: new Date()
              }
            }
          )
        }
      }
    }

    return { processed: gracePeriodStores.length }
  },

  /**
   * Process expired grace periods (freeze accounts)
   */
  async processExpiredGracePeriods() {
    await connectToDatabase()
    const db = require('mongoose').connection.db

    const now = new Date()

    // Find stores with expired grace periods
    const expiredGraceStores = await db.collection('stores').find({
      subscriptionStatus: 'grace_period',
      gracePeriodEnd: { $lt: now }
    }).toArray()

    for (const store of expiredGraceStores) {
      await this.freezeVendorAccount(store.vendorId)
    }

    return { frozen: expiredGraceStores.length }
  },

  /**
   * Daily subscription management job
   */
  async runDailySubscriptionJob() {
    const results = {
      expiryWarnings: 0,
      gracePeriodWarnings: 0,
      accountsFrozen: 0
    }

    try {
      // Send expiry warnings for subscriptions expiring tomorrow
      const expiryWarnings = await this.sendExpiryWarnings()
      results.expiryWarnings = expiryWarnings.processed

      // Send grace period warnings
      const gracePeriodWarnings = await this.sendGracePeriodWarnings()
      results.gracePeriodWarnings = gracePeriodWarnings.processed

      // Process expired grace periods (freeze accounts)
      const expiredGrace = await this.processExpiredGracePeriods()
      results.accountsFrozen = expiredGrace.frozen

      return { success: true, results }
    } catch (error) {
      console.error('Daily subscription job error:', error)
      return { success: false, error: error.message, results }
    }
  }
}