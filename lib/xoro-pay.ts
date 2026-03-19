import crypto from 'crypto'

interface XoroPaymentInitParams {
  email: string
  amount: number
  reference: string
  callbackUrl?: string
  metadata?: Record<string, any>
  currency?: string
}

interface XoroPaymentInitResult {
  success: boolean
  message?: string
  authorizationUrl?: string
  reference?: string
  raw?: any
}

interface XoroPaymentVerifyResult {
  success: boolean
  message?: string
  status?: string
  reference?: string
  amount?: number
  currency?: string
  paidAt?: string
  metadata?: Record<string, any>
  raw?: any
}

interface XoroTransferRecipientParams {
  name: string
  accountNumber: string
  bankCode: string
}

interface XoroTransferRecipientResult {
  success: boolean
  recipientCode?: string
  message?: string
  raw?: any
}

interface XoroTransferParams {
  amount: number
  recipientCode: string
  reference: string
  reason: string
}

interface XoroTransferResult {
  success: boolean
  transferCode?: string
  status?: string
  message?: string
  raw?: any
}

interface XoroResolveAccountResult {
  success: boolean
  accountName?: string
  accountNumber?: string
  bankCode?: string
  message?: string
  raw?: any
}

interface XoroBank {
  name: string
  code: string
}

interface XoroBankListResult {
  success: boolean
  banks?: XoroBank[]
  message?: string
  raw?: any
}

const DEFAULT_XORO_BASE_URL = 'https://api.xoropay.com'

const normalizeBaseUrl = (url: string) => {
  return url.replace(/\/+$/, '')
}

const asObject = (value: any) => {
  return value && typeof value === 'object' ? value : {}
}

const isSuccess = (payload: any) => {
  if (!payload || typeof payload !== 'object') return false
  if (payload.success === true) return true
  if (payload.status === true) return true
  if (String(payload.status || '').toLowerCase() === 'success') return true
  if (Number(payload.statusCode) >= 200 && Number(payload.statusCode) < 300) return true
  return false
}

const pick = <T = any>(source: any, keys: string[], fallback?: T): T | undefined => {
  for (const key of keys) {
    const value = source?.[key]
    if (value !== undefined && value !== null && value !== '') {
      return value as T
    }
  }
  return fallback
}

const toErrorMessage = (value: any, fallback: string): string => {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => toErrorMessage(item, ''))
      .filter(Boolean)
    return parts.join('; ') || fallback
  }
  if (value && typeof value === 'object') {
    const direct = value.message || value.msg || value.error || value.detail
    if (typeof direct === 'string' && direct.trim()) return direct
    const entries = Object.entries(value)
      .map(([key, val]) => `${key}: ${typeof val === 'string' ? val : JSON.stringify(val)}`)
      .join('; ')
    return entries || fallback
  }
  return fallback
}

class XoroPayService {
  private secretKey: string
  private publicKey: string
  private webhookSecret: string
  private baseUrl: string
  private defaultProcessor: string

  constructor() {
    this.secretKey = String(process.env.XORO_PAY_SECRET_KEY || '').trim()
    this.publicKey = String(process.env.XORO_PAY_PUBLIC_KEY || '').trim()
    this.webhookSecret = String(process.env.XORO_PAY_WEBHOOK_SECRET || this.secretKey).trim()
    this.baseUrl = normalizeBaseUrl(String(process.env.XORO_PAY_BASE_URL || DEFAULT_XORO_BASE_URL).trim())
    this.defaultProcessor = String(process.env.XORO_PAY_PROCESSOR || 'xoropay').trim().toLowerCase()
  }

  private hasCredentials() {
    return Boolean(this.secretKey)
  }

  private authHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }

    if (this.secretKey) {
      headers.Authorization = `Bearer ${this.secretKey}`
      headers['x-api-key'] = this.secretKey
    }

    if (this.publicKey) {
      headers['x-public-key'] = this.publicKey
    }

    return headers
  }

  private async call(path: string, init?: RequestInit) {
    if (!this.hasCredentials()) {
      return {
        ok: false,
        status: 500,
        payload: { success: false, message: 'XORO_PAY_SECRET_KEY missing on server' },
      }
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...this.authHeaders(),
        ...(init?.headers || {}),
      },
      cache: 'no-store',
    })

    const text = await response.text()
    let payload: any = {}
    try {
      payload = text ? JSON.parse(text) : {}
    } catch {
      payload = { message: text }
    }

    return {
      ok: response.ok,
      status: response.status,
      payload,
    }
  }

  private getNotificationUrl() {
    const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || '').trim() || 'https://www.makeitsell.org'
    return `${appUrl}/api/payments/webhook`
  }

  private normalizeAuthResponse(payload: any, fallbackReference: string) {
    const data = asObject(pick(payload, ['data', 'result'], {}))
    const checkout = asObject(pick(data, ['checkout'], {}))
    const authorizationUrl = pick<string>(data, [
      'authorization_url',
      'authorizationUrl',
      'checkout_url',
      'checkoutUrl',
      'hosted_url',
      'hostedUrl',
      'payment_link',
      'paymentLink',
      'link',
      'url',
    ]) || pick<string>(checkout, [
      'url',
      'link',
      'checkout_url',
      'checkoutUrl',
      'redirect_url',
      'redirectUrl',
    ]) || pick<string>(payload, [
      'authorization_url',
      'authorizationUrl',
      'checkout_url',
      'checkoutUrl',
      'hosted_url',
      'hostedUrl',
      'payment_link',
      'paymentLink',
      'link',
      'url',
    ])

    const reference = pick<string>(data, ['reference', 'payment_reference', 'paymentReference'])
      || pick<string>(payload, ['reference', 'payment_reference', 'paymentReference'])
      || fallbackReference

    return { authorizationUrl, reference }
  }

  async initializePayment(params: XoroPaymentInitParams): Promise<XoroPaymentInitResult> {
    const amountMajor = Math.round(Number(params.amount))
    const amountMinor = Math.round(Number(params.amount) * 100)
    const currency = 'NGN'
    const callbackUrl = params.callbackUrl || `${String(process.env.NEXT_PUBLIC_APP_URL || '').trim() || 'https://www.makeitsell.org'}/api/payments/verify`
    const metadata = asObject(params.metadata)

    const processorCandidates = Array.from(
      new Set([
        this.defaultProcessor,
        String(process.env.XORO_PAY_PROCESSOR || '').trim().toLowerCase(),
        'xoropay',
        '',
      ].filter(Boolean))
    )

    const attempts: Array<{ path: string; body: any }> = [
      {
        path: '/api/v1/initiate',
        body: {
          customer: {
            email: params.email,
            name: String(metadata.customerName || params.email.split('@')[0] || 'Customer'),
          },
          amount: amountMajor,
          currency,
          reference: params.reference,
          processor: this.defaultProcessor,
          redirect_url: callbackUrl,
          notification_url: this.getNotificationUrl(),
          metadata,
        },
      },
      {
        path: '/api/v1/initiate',
        body: {
          customer: {
            email: params.email,
            name: String(metadata.customerName || params.email.split('@')[0] || 'Customer'),
          },
          amount: amountMinor,
          currency,
          reference: params.reference,
          processor: this.defaultProcessor,
          redirect_url: callbackUrl,
          notification_url: this.getNotificationUrl(),
          metadata,
        },
      },
      {
        path: '/api/v1/initiate',
        body: {
          customer: {
            email: params.email,
            name: String(metadata.customerName || params.email.split('@')[0] || 'Customer'),
          },
          amount: amountMajor,
          currency,
          reference: params.reference,
          redirect_url: callbackUrl,
          notification_url: this.getNotificationUrl(),
          metadata,
        },
      },
      {
        path: '/payments/initialize',
        body: {
          email: params.email,
          amount: amountMinor,
          currency: currency,
          reference: params.reference,
          callback_url: callbackUrl,
          metadata,
        },
      },
    ]

    for (const processor of processorCandidates) {
      attempts.push({
        path: '/api/v1/initiate',
        body: {
          customer: {
            email: params.email,
            name: String(metadata.customerName || params.email.split('@')[0] || 'Customer'),
          },
          amount: amountMinor,
          currency,
          reference: params.reference,
          processor,
          redirect_url: callbackUrl,
          notification_url: this.getNotificationUrl(),
          metadata,
        },
      })
    }

    let lastPayload: any = {}
    let lastMessage = 'Failed to initialize Xoro payment'

    for (const attempt of attempts) {
      const result = await this.call(attempt.path, {
        method: 'POST',
        body: JSON.stringify(attempt.body),
      })

      lastPayload = result.payload
      lastMessage = toErrorMessage(
        pick(result.payload, ['message', 'error', 'detail', 'details'], lastMessage),
        lastMessage
      )

      const normalized = this.normalizeAuthResponse(result.payload, params.reference)
      const ok = (result.ok || isSuccess(result.payload)) && Boolean(normalized.authorizationUrl)

      if (ok) {
        return {
          success: true,
          authorizationUrl: normalized.authorizationUrl,
          reference: normalized.reference,
          raw: result.payload,
        }
      }
    }

    return {
      success: false,
      message: lastMessage,
      reference: params.reference,
      raw: lastPayload,
    }
  }

  async verifyPayment(reference: string): Promise<XoroPaymentVerifyResult> {
    const encodedReference = encodeURIComponent(reference)
    const paths = [
      `/api/v1/verify/${encodedReference}`,
      `/api/v1/verify?reference=${encodedReference}`,
      `/api/v1/transaction/verify/${encodedReference}`,
      `/payments/verify/${encodedReference}`,
      `/payments/verify?reference=${encodedReference}`,
    ]

    let resolved: Awaited<ReturnType<XoroPayService['call']>> | null = null
    for (const path of paths) {
      const response = await this.call(path, { method: 'GET' })
      resolved = response
      if (response.ok || isSuccess(response.payload)) {
        break
      }
    }

    if (!resolved) {
      return {
        success: false,
        message: 'Payment verification failed',
      }
    }

    const payload = resolved.payload
    const data = asObject(pick(payload, ['data', 'result'], {}))

    const status = String(
      pick(data, ['status', 'payment_status', 'paymentStatus'])
      || pick(payload, ['status', 'payment_status', 'paymentStatus'])
      || ''
    ).toLowerCase()

    const succeeded = resolved.ok && (
      status === 'success'
      || status === 'completed'
      || status === 'paid'
      || isSuccess(payload)
    )

    return {
      success: succeeded,
      message: succeeded ? undefined : toErrorMessage(pick(payload, ['message', 'error', 'detail', 'details']), 'Payment verification failed'),
      status,
      reference: pick<string>(data, ['reference', 'payment_reference', 'paymentReference']) || reference,
      amount: Number(pick(data, ['amount', 'amount_paid', 'amountPaid']) || 0) / 100,
      currency: pick<string>(data, ['currency'], 'NGN'),
      paidAt: pick<string>(data, ['paid_at', 'paidAt']),
      metadata: asObject(pick(data, ['metadata'], {})),
      raw: payload,
    }
  }

  async listBanks(): Promise<XoroBankListResult> {
    const paths = [
      '/api/v1/banks?country=nigeria&use_cursor=false',
      '/banks?country=nigeria&use_cursor=false',
    ]

    let lastPayload: any = {}
    for (const path of paths) {
      const result = await this.call(path, { method: 'GET' })
      const payload = result.payload
      lastPayload = payload
      const rawBanks = pick<any[]>(payload, ['data', 'banks', 'result'], []) || []

      const banks = Array.isArray(rawBanks)
        ? rawBanks
            .map((bank: any) => ({
              name: String(bank?.name || bank?.bank_name || '').trim(),
              code: String(bank?.code || bank?.bank_code || '').trim(),
            }))
            .filter((bank: XoroBank) => bank.name && bank.code)
        : []

      const ok = (result.ok || isSuccess(payload)) && banks.length > 0
      if (ok) {
        return {
          success: true,
          banks,
          raw: payload,
        }
      }
    }

    return {
      success: false,
      message: toErrorMessage(pick(lastPayload, ['message', 'error', 'detail', 'details']), 'Failed to fetch banks from Xoro Pay'),
      raw: lastPayload,
    }
  }

  async resolveAccount(bankCode: string, accountNumber: string): Promise<XoroResolveAccountResult> {
    const query = `account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`
    const paths = [
      `/api/v1/banks/resolve?${query}`,
      `/banks/resolve?${query}`,
    ]

    let lastPayload: any = {}
    for (const path of paths) {
      const result = await this.call(path, { method: 'GET' })
      const payload = result.payload
      lastPayload = payload
      const data = asObject(pick(payload, ['data', 'result'], {}))

      const accountName = pick<string>(data, ['account_name', 'accountName'])
        || pick<string>(payload, ['account_name', 'accountName'])

      const ok = (result.ok || isSuccess(payload)) && Boolean(accountName)
      if (ok) {
        return {
          success: true,
          accountName,
          accountNumber: pick<string>(data, ['account_number', 'accountNumber'], accountNumber),
          bankCode: pick<string>(data, ['bank_code', 'bankCode'], bankCode),
          raw: payload,
        }
      }
    }

    return {
      success: false,
      message: toErrorMessage(pick(lastPayload, ['message', 'error', 'detail', 'details']), 'Failed to resolve account'),
      raw: lastPayload,
    }
  }

  async createTransferRecipient(params: XoroTransferRecipientParams): Promise<XoroTransferRecipientResult> {
    const attempts = [
      {
        path: '/api/v1/payout/recipient',
        body: {
          type: 'nuban',
          name: params.name,
          account_number: params.accountNumber,
          bank_code: params.bankCode,
          currency: 'NGN',
        },
      },
      {
        path: '/transfers/recipients',
        body: {
          type: 'nuban',
          name: params.name,
          account_number: params.accountNumber,
          bank_code: params.bankCode,
          currency: 'NGN',
        },
      },
    ]

    let lastPayload: any = {}
    for (const attempt of attempts) {
      const result = await this.call(attempt.path, {
        method: 'POST',
        body: JSON.stringify(attempt.body),
      })

      const payload = result.payload
      lastPayload = payload
      const data = asObject(pick(payload, ['data', 'result'], {}))
      const recipientCode = pick<string>(data, ['recipient_code', 'recipientCode', 'code'])
        || pick<string>(payload, ['recipient_code', 'recipientCode'])

      const ok = (result.ok || isSuccess(payload)) && Boolean(recipientCode)
      if (ok) {
        return {
          success: true,
          recipientCode,
          raw: payload,
        }
      }
    }

    return {
      success: false,
      message: toErrorMessage(pick(lastPayload, ['message', 'error', 'detail', 'details']), 'Unable to create transfer recipient'),
      raw: lastPayload,
    }
  }

  async initiateTransfer(params: XoroTransferParams): Promise<XoroTransferResult> {
    const attempts = [
      {
        path: '/api/v1/payout',
        body: {
          amount: Math.round(Number(params.amount)),
          recipient: params.recipientCode,
          reference: params.reference,
          reason: params.reason,
          currency: 'NGN',
        },
      },
      {
        path: '/transfers',
        body: {
          source: 'balance',
          amount: Math.round(Number(params.amount) * 100),
          recipient: params.recipientCode,
          reason: params.reason,
          reference: params.reference,
        },
      },
    ]

    let lastPayload: any = {}
    for (const attempt of attempts) {
      const result = await this.call(attempt.path, {
        method: 'POST',
        body: JSON.stringify(attempt.body),
      })

      const payload = result.payload
      lastPayload = payload
      const data = asObject(pick(payload, ['data', 'result'], {}))
      const transferCode = pick<string>(data, ['transfer_code', 'transferCode', 'code'])
        || pick<string>(payload, ['transfer_code', 'transferCode'])

      const status = String(
        pick(data, ['status', 'transfer_status', 'transferStatus'])
        || pick(payload, ['status', 'transfer_status', 'transferStatus'])
        || ''
      ).toLowerCase()

      const ok = (result.ok || isSuccess(payload)) && Boolean(transferCode) && status !== 'failed'
      if (ok) {
        return {
          success: true,
          transferCode,
          status,
          raw: payload,
        }
      }
    }

    return {
      success: false,
      message: toErrorMessage(pick(lastPayload, ['message', 'error', 'detail', 'details']), 'Unable to initiate transfer'),
      raw: lastPayload,
    }
  }

  verifyWebhook(rawBody: string, signature: string): boolean {
    if (!this.webhookSecret || !signature) {
      return false
    }

    const expectedSha256 = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex')

    const expectedSha512 = crypto
      .createHmac('sha512', this.webhookSecret)
      .update(rawBody)
      .digest('hex')

    return signature === expectedSha256 || signature === expectedSha512
  }
}

export const xoroPayService = new XoroPayService()
