import crypto from 'crypto'

interface PaymentData {
  email: string
  amount: number
  orderId: string
  customerId: string
  items: any[]
  callbackUrl?: string
}

interface PaymentResponse {
  success: boolean
  data?: any
  message?: string
  authUrl?: string
    subscriptionCode?: string
}

  interface SubscriptionPlan {
    name: string
    amount: number
    interval: 'monthly' | 'annually'
    description?: string
  }

  interface SubscriptionData {
    customer: string // email or customer code
    plan: string // plan code
    authorization?: string // authorization code if customer has paid before
    start_date?: string
  }
class PaystackService {
  private secretKey: string
  private publicKey: string

  constructor() {
    // Trim to avoid whitespace/newline issues from envs
    this.secretKey = (process.env.PAYSTACK_SECRET_KEY || '').trim()
    this.publicKey = (process.env.PAYSTACK_PUBLIC_KEY || '').trim()
  }

    // Create a subscription plan on Paystack
    async createSubscriptionPlan(planData: SubscriptionPlan): Promise<PaymentResponse> {
      try {
        if (!this.secretKey || !this.secretKey.startsWith('sk_')) {
          return {
            success: false,
            message: 'PAYSTACK_SECRET_KEY missing or invalid'
          }
        }

        const url = 'https://api.paystack.co/plan'
        const payload = {
          name: planData.name,
          amount: Math.round(planData.amount * 100), // in kobo
          interval: planData.interval,
          description: planData.description || '',
          currency: 'NGN'
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })

        const result = await response.json()
        console.log('PaystackService: Create plan response:', result)

        if (result.status) {
          return {
            success: true,
            data: result.data
          }
        }

        return { success: false, message: result.message || 'Plan creation failed' }
      } catch (error) {
        console.error('Create subscription plan error:', error)
        return {
          success: false,
          message: 'Failed to create subscription plan'
        }
      }
    }

    // Subscribe a customer to a plan
    async createSubscription(subscriptionData: SubscriptionData): Promise<PaymentResponse> {
      try {
        if (!this.secretKey || !this.secretKey.startsWith('sk_')) {
          return {
            success: false,
            message: 'PAYSTACK_SECRET_KEY missing or invalid'
          }
        }

        const url = 'https://api.paystack.co/subscription'
        const payload = {
          customer: subscriptionData.customer,
          plan: subscriptionData.plan,
          authorization: subscriptionData.authorization,
          start_date: subscriptionData.start_date
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })

        const result = await response.json()
        console.log('PaystackService: Create subscription response:', result)

        if (result.status) {
          return {
            success: true,
            data: result.data,
            subscriptionCode: result.data.subscription_code,
            authUrl: result.data.authorization_url || result.data.email_token
          }
        }

        return { success: false, message: result.message || 'Subscription creation failed' }
      } catch (error) {
        console.error('Create subscription error:', error)
        return {
          success: false,
          message: 'Failed to create subscription'
        }
      }
    }

    // Initialize subscription payment (for new customers without authorization code)
    async initializeSubscriptionPayment(paymentData: PaymentData & { planCode: string }): Promise<PaymentResponse> {
      try {
        console.log('PaystackService: Initializing subscription payment:', paymentData)
        if (!this.secretKey || !this.secretKey.startsWith('sk_')) {
          return {
            success: false,
            message: 'PAYSTACK_SECRET_KEY missing or invalid'
          }
        }

        const url = 'https://api.paystack.co/transaction/initialize'
      
        const isSignupSubscription = paymentData.items.some(item => item.productId === 'vendor-subscription-signup')
        const callbackUrl = isSignupSubscription 
          ? `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/vendor-subscription-signup/callback`
          : `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/vendor-subscription/callback`
      
        const payload = {
          email: paymentData.email,
          amount: Math.round(paymentData.amount * 100), // in kobo
          currency: 'NGN',
          reference: `${paymentData.orderId}-${Date.now()}`,
          callback_url: callbackUrl,
          plan: paymentData.planCode, // This links the transaction to the subscription plan
          metadata: {
            orderId: paymentData.orderId,
            customerId: paymentData.customerId,
            items: JSON.stringify(paymentData.items),
            type: isSignupSubscription ? 'vendor_signup_subscription' : 'vendor_subscription',
            planCode: paymentData.planCode
          }
        }

        console.log('PaystackService: Sending subscription payload to Paystack:', payload)

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })

        const result = await response.json()
        console.log('PaystackService: Subscription payment response:', result)

        if (result.status) {
          return {
            success: true,
            data: result.data,
            authUrl: result.data.authorization_url
          }
        }

        return { success: false, message: result.message || 'Subscription payment initialization failed' }
      } catch (error) {
        console.error('Initialize subscription payment error:', error)
        return {
          success: false,
          message: 'Failed to initialize subscription payment'
        }
      }
    }

    // Cancel a subscription
    async cancelSubscription(subscriptionCode: string, emailToken: string): Promise<PaymentResponse> {
      try {
        if (!this.secretKey || !this.secretKey.startsWith('sk_')) {
          return {
            success: false,
            message: 'PAYSTACK_SECRET_KEY missing or invalid'
          }
        }

        const url = 'https://api.paystack.co/subscription/disable'
        const payload = {
          code: subscriptionCode,
          token: emailToken
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })

        const result = await response.json()

        if (result.status) {
          return {
            success: true,
            message: 'Subscription cancelled successfully'
          }
        }

        return { success: false, message: result.message || 'Failed to cancel subscription' }
      } catch (error) {
        console.error('Cancel subscription error:', error)
        return {
          success: false,
          message: 'Failed to cancel subscription'
        }
      }
    }

    // Get subscription details
    async getSubscription(subscriptionCode: string): Promise<PaymentResponse> {
      try {
        if (!this.secretKey || !this.secretKey.startsWith('sk_')) {
          return {
            success: false,
            message: 'PAYSTACK_SECRET_KEY missing or invalid'
          }
        }

        const url = `https://api.paystack.co/subscription/${subscriptionCode}`

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        })

        const result = await response.json()

        if (result.status) {
          return {
            success: true,
            data: result.data
          }
        }

        return { success: false, message: result.message || 'Failed to fetch subscription' }
      } catch (error) {
        console.error('Get subscription error:', error)
        return {
          success: false,
          message: 'Failed to fetch subscription'
        }
      }
    }
  async initializePayment(paymentData: PaymentData): Promise<PaymentResponse> {
    try {
      console.log('PaystackService: Initializing payment with data:', paymentData)
      console.log('PaystackService: Secret key exists:', !!this.secretKey)
      if (!this.secretKey || !this.secretKey.startsWith('sk_')) {
        console.error('PaystackService: Missing or invalid PAYSTACK_SECRET_KEY at runtime')
        return {
          success: false,
          message: 'PAYSTACK_SECRET_KEY missing or invalid on server. Redeploy after setting env.'
        }
      }
      
      const url = 'https://api.paystack.co/transaction/initialize'
      
      // Determine callback URL based on order type
      const isSubscription = paymentData.items.some(item => item.productId === 'vendor-subscription')
      const isSignupSubscription = paymentData.items.some(item => item.productId === 'vendor-subscription-signup')
      
      let callbackUrl = paymentData.callbackUrl || `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/verify`
      
      if (!paymentData.callbackUrl) {
        if (isSignupSubscription) {
          callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/vendor-subscription-signup/callback`
        } else if (isSubscription) {
          callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/vendor-subscription/callback`
        }
      }
      
      const payload = {
        email: paymentData.email,
        amount: Math.round(paymentData.amount * 100), // Paystack expects amount in kobo
        currency: 'NGN',
        reference: `${paymentData.orderId}-${Date.now()}`,
        callback_url: callbackUrl,
        metadata: {
          orderId: paymentData.orderId,
          customerId: paymentData.customerId,
          items: JSON.stringify(paymentData.items),
          type: isSignupSubscription ? 'vendor_signup' : (isSubscription ? 'vendor_subscription' : 'order')
        }
      }

      console.log('PaystackService: Sending payload to Paystack:', payload)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json()
      console.log('PaystackService: Paystack API response:', result)

      if (result.status) {
        return {
          success: true,
          data: result.data,
          authUrl: result.data.authorization_url
        }
      }

      console.error('PaystackService: Paystack API error:', result)

      // Fallback: try official Paystack SDK (may handle headers better on some runtimes)
      try {
        const sdkModule: any = await import('paystack')
        const Paystack = (sdkModule as any).default || sdkModule
        const paystack = Paystack(this.secretKey)
        const sdkRes = await paystack.transaction.initialize({
          email: payload.email,
          amount: payload.amount,
          currency: payload.currency,
          reference: payload.reference,
          callback_url: payload.callback_url,
          metadata: payload.metadata,
        })
        if (sdkRes?.status && sdkRes?.data?.authorization_url) {
          return { success: true, data: sdkRes.data, authUrl: sdkRes.data.authorization_url }
        }
        console.error('PaystackService: SDK initialization failed:', sdkRes)
      } catch (sdkErr) {
        console.error('PaystackService: SDK fallback error:', sdkErr)
      }

      return { success: false, message: result.message || 'Payment initialization failed' }
    } catch (error) {
      console.error('Paystack initialization error:', error)
      return {
        success: false,
        message: 'Payment service temporarily unavailable'
      }
    }
  }

  async verifyPayment(reference: string): Promise<PaymentResponse> {
    try {
      const url = `https://api.paystack.co/transaction/verify/${reference}`
      
      if (!this.secretKey || !this.secretKey.startsWith('sk_')) {
        console.error('PaystackService: Missing or invalid PAYSTACK_SECRET_KEY for verification')
        return {
          success: false,
          message: 'PAYSTACK_SECRET_KEY missing or invalid on server. Redeploy after setting env.'
        }
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
      })

      const result = await response.json()

      if (result.status && result.data.status === 'success') {
        return {
          success: true,
          data: result.data
        }
      }

      // Fallback: SDK verify
      try {
        const sdkModule: any = await import('paystack')
        const Paystack = (sdkModule as any).default || sdkModule
        const paystack = Paystack(this.secretKey)
        const sdkRes = await paystack.transaction.verify(reference)
        if (sdkRes?.status && sdkRes?.data?.status === 'success') {
          return { success: true, data: sdkRes.data }
        }
        console.error('PaystackService: SDK verify failed:', sdkRes)
      } catch (sdkErr) {
        console.error('PaystackService: SDK verify fallback error:', sdkErr)
      }

      return { success: false, message: result.message || 'Payment verification failed' }
    } catch (error) {
      console.error('Paystack verification error:', error)
      return {
        success: false,
        message: 'Payment verification failed'
      }
    }
  }

  verifyWebhook(payload: any, signature: string): boolean {
    try {
      const hash = crypto
        .createHmac('sha512', this.secretKey)
        .update(JSON.stringify(payload))
        .digest('hex')
      
      return hash === signature
    } catch (error) {
      console.error('Webhook verification error:', error)
      return false
    }
  }
}

export const paystackService = new PaystackService()