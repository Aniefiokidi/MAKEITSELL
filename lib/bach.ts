import crypto from 'crypto'

const BACH_API_BASE = 'https://api.bachs.xyz/v1'

interface BachCheckoutParams {
  amount: number
  email: string
  name: string
  phoneNumber?: string
  orderId: string
  customerId: string
  returnUrl: string
}

export interface BachCheckoutResult {
  success: boolean
  checkoutId?: string
  checkoutUrl?: string
  error?: string
}

export interface BachSessionStatus {
  checkout_id: string
  status: string
  reference?: string
  metadata?: Record<string, any>
  [key: string]: any
}

class BachService {
  private get headers() {
    return {
      Authorization: `Bearer ${process.env.BACH_SECRET_KEY}`,
      'Content-Type': 'application/json',
    }
  }

  async initializeCheckout(params: BachCheckoutParams): Promise<BachCheckoutResult> {
    const productId = process.env.BACH_PRODUCT_ID
    if (!productId) {
      return { success: false, error: 'BACH_PRODUCT_ID not configured — create a custom-priced product in your Bach dashboard and set this env var.' }
    }

    try {
      const response = await fetch(`${BACH_API_BASE}/checkout-sessions`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          product_cart: [{ product_id: productId, quantity: 1, amount: params.amount }],
          customer: {
            email: params.email,
            name: params.name,
            ...(params.phoneNumber ? { phone_number: params.phoneNumber } : {}),
          },
          billing_currency: 'NGN',
          return_url: params.returnUrl,
          reference: params.orderId,
          metadata: {
            order_id: params.orderId,
            customer_id: params.customerId,
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data?.message || data?.error || 'Bach checkout session creation failed' }
      }

      return {
        success: true,
        checkoutId: data.checkout_id,
        checkoutUrl: data.checkout_url,
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error creating Bach checkout' }
    }
  }

  async getCheckoutSession(checkoutId: string): Promise<BachSessionStatus | null> {
    try {
      const response = await fetch(`${BACH_API_BASE}/checkout-sessions/${checkoutId}`, {
        headers: this.headers,
      })
      if (!response.ok) return null
      return response.json()
    } catch {
      return null
    }
  }

  verifyWebhook(rawBody: string, timestamp: string, signature: string): boolean {
    try {
      const secret = process.env.BACH_WEBHOOK_SECRET
      if (!secret) return false
      const message = `${timestamp}.${rawBody}`
      const expected = crypto.createHmac('sha256', secret).update(message, 'utf-8').digest('hex')
      return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
    } catch {
      return false
    }
  }
}

export const bachService = new BachService()
