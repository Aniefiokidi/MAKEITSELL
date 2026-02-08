import connectToDatabase from './mongodb'

/**
 * Middleware to filter out frozen/inactive stores and services from customer-facing endpoints
 */
export const SubscriptionFilterMiddleware = {
  /**
   * Filter stores to only show active ones to customers
   */
  async filterActiveStores(stores: any[]) {
    return stores.filter(store => 
      store.isActive !== false && 
      store.frozen !== true && 
      store.accountStatus !== 'frozen' && 
      store.accountStatus !== 'suspended' &&
      store.subscriptionStatus !== 'expired'
    )
  },

  /**
   * Filter services to only show active ones to customers
   */
  async filterActiveServices(services: any[]) {
    return services.filter(service => 
      service.status === 'active' &&
      service.frozen !== true
    )
  },

  /**
   * Check if a specific store is accessible to customers
   */
  async isStoreAccessible(storeId: string): Promise<boolean> {
    try {
      await connectToDatabase()
      const db = require('mongoose').connection.db

      const store = await db.collection('stores').findOne({ 
        $or: [{ _id: storeId }, { vendorId: storeId }]
      })

      if (!store) return false

      return store.isActive !== false && 
             store.frozen !== true && 
             store.accountStatus !== 'frozen' && 
             store.accountStatus !== 'suspended' &&
             store.subscriptionStatus !== 'expired'
    } catch (error) {
      console.error('Error checking store accessibility:', error)
      return false
    }
  },

  /**
   * Check if a specific service is accessible to customers
   */
  async isServiceAccessible(serviceId: string): Promise<boolean> {
    try {
      await connectToDatabase()
      const db = require('mongoose').connection.db

      const service = await db.collection('services').findOne({ 
        $or: [{ _id: serviceId }, { providerId: serviceId }]
      })

      if (!service) return false

      return service.status === 'active' && service.frozen !== true
    } catch (error) {
      console.error('Error checking service accessibility:', error)
      return false
    }
  },

  /**
   * Get vendor subscription status
   */
  async getVendorSubscriptionStatus(vendorId: string) {
    try {
      await connectToDatabase()
      const db = require('mongoose').connection.db

      const store = await db.collection('stores').findOne({ vendorId })
      
      if (!store) {
        return { status: 'no_store', accessible: false }
      }

      const now = new Date()
      const subscriptionExpiry = store.subscriptionExpiry ? new Date(store.subscriptionExpiry) : null
      
      const status = {
        subscriptionStatus: store.subscriptionStatus || 'unknown',
        accountStatus: store.accountStatus || 'unknown',
        isActive: store.isActive ?? true,
        frozen: store.frozen ?? false,
        subscriptionExpiry,
        isExpired: subscriptionExpiry ? subscriptionExpiry <= now : false,
        accessible: store.isActive !== false && 
                   store.frozen !== true && 
                   store.accountStatus !== 'frozen' && 
                   store.accountStatus !== 'suspended' &&
                   store.subscriptionStatus !== 'expired'
      }

      return status
    } catch (error) {
      console.error('Error getting vendor subscription status:', error)
      return { status: 'error', accessible: false }
    }
  }
}