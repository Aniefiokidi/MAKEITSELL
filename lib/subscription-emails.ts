export interface SubscriptionNotificationData {
  vendorEmail: string
  vendorName: string
  storeName: string
  subscriptionExpiry: Date
  amount: number
  reference?: string
}

export const SubscriptionEmailService = {
  async sendSubscriptionConfirmation(_data: SubscriptionNotificationData) {
    return
  },

  async sendExpiryWarning(_data: SubscriptionNotificationData) {
    return
  },

  async sendRenewalFailed(_data: SubscriptionNotificationData & { reason: string }) {
    return
  },

  async sendGracePeriodWarning(_data: SubscriptionNotificationData & { daysRemaining: number }) {
    return
  },

  async sendAccountFrozen(_data: SubscriptionNotificationData) {
    return
  },

  async sendAccountReactivated(_data: SubscriptionNotificationData) {
    return
  }
}