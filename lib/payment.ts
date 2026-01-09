import crypto from 'crypto'

interface PaymentData {
  email: string
  amount: number
  orderId: string
  customerId: string
  items: any[]
}

interface PaymentResponse {
  success: boolean
  data?: any
  message?: string
  authUrl?: string
}

class PaystackService {
  private secretKey: string
  private publicKey: string

  constructor() {
    // Trim to avoid whitespace/newline issues from envs
    this.secretKey = (process.env.PAYSTACK_SECRET_KEY || '').trim()
    this.publicKey = (process.env.PAYSTACK_PUBLIC_KEY || '').trim()
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
      
      let callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/verify`
      
      if (isSignupSubscription) {
        callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/vendor-subscription-signup/callback`
      } else if (isSubscription) {
        callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/vendor-subscription/callback`
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
      return {
        success: false,
        message: result.message || 'Payment initialization failed'
      }
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

      return {
        success: false,
        message: result.message || 'Payment verification failed'
      }
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