import crypto from 'crypto'
import { getCanonicalAppBaseUrl } from '@/lib/app-url'

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
  accountNumber?: string
  bankCode?: string
  accountName?: string
  customerEmail?: string
  customerName?: string
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
  nibssBankCode?: string
}

interface XoroBankListResult {
  success: boolean
  banks?: XoroBank[]
  message?: string
  raw?: any
}

const DEFAULT_XORO_BASE_URL = 'https://api.xoropay.com'

const XORO_BANK_CODE_ALIASES: Record<string, string> = {
  // OPay aliases (Paystack and NIBSS variants) -> Xoropay payout code
  '999992': '305',
  '100004': '305',
}

const normalizeBankCode = (code: string, aliases: Record<string, string> = XORO_BANK_CODE_ALIASES) => {
  const clean = String(code || '').trim()
  return aliases[clean] || clean
}

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

const isSuccessLikeStatus = (status: string) => {
  const normalized = String(status || '').trim().toLowerCase()
  if (!normalized) return false
  const tokens = normalized.split(/[^a-z0-9]+/).filter(Boolean)
  if (tokens.length === 0) return false
  return tokens.some((token) => (
    token === 'success'
    || token === 'successful'
    || token === 'succeeded'
    || token === 'completed'
    || token === 'complete'
    || token === 'paid'
    || token === 'approved'
    || token === 'ok'
    || token === 'true'
  ))
}

const isFailureLikeStatus = (status: string) => {
  const normalized = String(status || '').trim().toLowerCase()
  if (!normalized) return false
  const tokens = normalized.split(/[^a-z0-9]+/).filter(Boolean)
  if (tokens.length === 0) return false
  return tokens.some((token) => (
    token === 'failed'
    || token === 'fail'
    || token === 'failure'
    || token === 'declined'
    || token === 'decline'
    || token === 'cancelled'
    || token === 'canceled'
    || token === 'cancel'
    || token === 'reversed'
    || token === 'reverse'
    || token === 'abandoned'
    || token === 'expired'
    || token === 'insufficient'
    || token === 'error'
  ))
}

const isFailureLikeMessage = (message: string) => {
  const normalized = String(message || '').trim().toLowerCase()
  if (!normalized) return false
  return (
    normalized.includes('fail')
    || normalized.includes('declin')
    || normalized.includes('cancel')
    || normalized.includes('insufficient')
    || normalized.includes('not charged')
    || normalized.includes('unable')
    || normalized.includes('error')
  )
}

class XoroPayService {
  private secretKey: string
  private publicKey: string
  private webhookSecret: string
  private baseUrl: string
  private defaultProcessor: string
  private bankCodeAliasCache: {
    expiresAt: number
    aliases: Record<string, string>
  } | null

  constructor() {
    this.secretKey = String(process.env.XORO_PAY_SECRET_KEY || '').trim()
    this.publicKey = String(process.env.XORO_PAY_PUBLIC_KEY || '').trim()
    this.webhookSecret = String(process.env.XORO_PAY_WEBHOOK_SECRET || this.secretKey).trim()
    this.baseUrl = normalizeBaseUrl(String(process.env.XORO_PAY_BASE_URL || DEFAULT_XORO_BASE_URL).trim())
    this.defaultProcessor = String(process.env.XORO_PAY_PROCESSOR || 'xoropay').trim().toLowerCase()
    this.bankCodeAliasCache = null
  }

  private buildBankCodeAliases(rawBanks: any[]): Record<string, string> {
    const aliases: Record<string, string> = {
      ...XORO_BANK_CODE_ALIASES,
    }

    for (const bank of rawBanks) {
      const code = String(bank?.code || bank?.bank_code || '').trim()
      const nibss = String(bank?.nibss_bank_code || bank?.nibssBankCode || '').trim()
      if (!code) continue
      aliases[code] = code
      if (nibss) {
        aliases[nibss] = code
      }
    }

    return aliases
  }

  private async getBankCodeAliases(): Promise<Record<string, string>> {
    const now = Date.now()
    if (this.bankCodeAliasCache && this.bankCodeAliasCache.expiresAt > now) {
      return this.bankCodeAliasCache.aliases
    }

    const fallbackAliases = { ...XORO_BANK_CODE_ALIASES }
    const paths = [
      '/banks?country=nigeria&use_cursor=false',
      '/api/v1/banks?country=nigeria&use_cursor=false',
    ]

    let aliases = fallbackAliases
    for (const path of paths) {
      try {
        const result = await this.call(path, { method: 'GET' })
        const payload = result.payload
        const rawBanks = pick<any[]>(payload, ['data', 'banks', 'result'], []) || (Array.isArray(payload) ? payload : [])

        if (!Array.isArray(rawBanks) || rawBanks.length === 0) {
          continue
        }

        aliases = this.buildBankCodeAliases(rawBanks)
        if (result.ok || isSuccess(payload)) {
          break
        }
      } catch {
        // Keep fallback aliases when bank directory fetch is unavailable.
      }
    }

    this.bankCodeAliasCache = {
      expiresAt: now + 1000 * 60 * 60,
      aliases,
    }

    return aliases
  }

  async normalizeBankCodeForPayout(code: string): Promise<string> {
    try {
      const aliases = await this.getBankCodeAliases()
      return normalizeBankCode(code, aliases)
    } catch {
      return normalizeBankCode(code)
    }
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
    const appUrl = getCanonicalAppBaseUrl()
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
    const callbackUrl = params.callbackUrl || `${getCanonicalAppBaseUrl()}/api/payments/verify`
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
      `/api/v1/transactions/verify/${encodedReference}`,
      `/api/v1/transaction/verify?reference=${encodedReference}`,
      `/api/v1/transactions/verify?reference=${encodedReference}`,
      `/api/v1/payment/verify/${encodedReference}`,
      `/api/v1/payment/verify?reference=${encodedReference}`,
      `/api/v1/payments/verify/${encodedReference}`,
      `/api/v1/payments/verify?reference=${encodedReference}`,
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

    const rawStatusCandidates = [
      pick(data, ['status', 'payment_status', 'paymentStatus']),
      pick(payload, ['status', 'payment_status', 'paymentStatus']),
      pick(data, ['transaction_status', 'transactionStatus']),
      pick(payload, ['transaction_status', 'transactionStatus']),
    ]

    const statusCandidates = rawStatusCandidates
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean)

    const status = statusCandidates[0] || ''
    const statusSucceeded = statusCandidates.some((value) => isSuccessLikeStatus(value))
    const statusFailed = statusCandidates.some((value) => isFailureLikeStatus(value))

    const message = toErrorMessage(
      pick(payload, ['message', 'error', 'detail', 'details']),
      ''
    )
    const messageFailed = isFailureLikeMessage(message)
    const messageSucceeded = isSuccessLikeStatus(message)

    const booleanSuccessHint = (
      pick<boolean>(payload, ['success'], false) === true
      || pick<boolean>(data, ['success'], false) === true
      || pick<boolean>(payload, ['status'], false) === true
      || pick<boolean>(data, ['status'], false) === true
    )

    // Do not treat API transport success or bare boolean flags as payment success
    // unless there is an explicit success-like signal and no failure indicators.
    const succeeded = !statusFailed
      && !messageFailed
      && (statusSucceeded || (booleanSuccessHint && messageSucceeded && resolved.ok))
    const failed = statusFailed || messageFailed

    return {
      success: succeeded && !failed,
      message: succeeded && !failed ? undefined : toErrorMessage(pick(payload, ['message', 'error', 'detail', 'details']), 'Payment verification failed'),
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
      const rawBanks = pick<any[]>(payload, ['data', 'banks', 'result'], []) || (Array.isArray(payload) ? payload : [])

      const banks = Array.isArray(rawBanks)
        ? rawBanks
            .map((bank: any) => ({
              name: String(bank?.name || bank?.bank_name || '').trim(),
              code: String(bank?.code || bank?.bank_code || '').trim(),
              nibssBankCode: String(bank?.nibss_bank_code || bank?.nibssBankCode || '').trim() || undefined,
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
    const normalizedBankCode = await this.normalizeBankCodeForPayout(bankCode)
    const query = `account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(normalizedBankCode)}`
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
          bankCode: pick<string>(data, ['bank_code', 'bankCode'], normalizedBankCode),
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
    const normalizedBankCode = await this.normalizeBankCodeForPayout(params.bankCode)
    const attempts = [
      {
        path: '/api/v1/payout/recipient',
        body: {
          type: 'nuban',
          name: params.name,
          account_number: params.accountNumber,
          bank_code: normalizedBankCode,
          currency: 'NGN',
        },
      },
      {
        path: '/api/v1/payout/recipients',
        body: {
          type: 'nuban',
          name: params.name,
          account_number: params.accountNumber,
          bank_code: normalizedBankCode,
          currency: 'NGN',
        },
      },
      {
        path: '/api/v1/transferrecipient',
        body: {
          type: 'nuban',
          name: params.name,
          account_number: params.accountNumber,
          bank_code: normalizedBankCode,
          currency: 'NGN',
        },
      },
      {
        path: '/api/v1/transfer-recipient',
        body: {
          type: 'nuban',
          name: params.name,
          account_number: params.accountNumber,
          bank_code: normalizedBankCode,
          currency: 'NGN',
        },
      },
      {
        path: '/api/v1/transfer/recipient',
        body: {
          type: 'nuban',
          name: params.name,
          account_number: params.accountNumber,
          bank_code: normalizedBankCode,
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
        || pick<string>(data, ['id', '_id', 'reference'])
        || pick<string>(payload, ['id', '_id', 'reference'])

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
    const amountMajor = Math.round(Number(params.amount))
    const amountMinor = Math.round(Number(params.amount) * 100)
    const normalizedBankCode = await this.normalizeBankCodeForPayout(String(params.bankCode || ''))

    const attempts: Array<{ path: string; body: Record<string, any> }> = []

    if (params.accountNumber && params.bankCode) {
      const customer = {
        email: params.customerEmail || `${params.reference}@makeitsell.local`,
        name: params.customerName || params.accountName || 'Customer',
      }

      const destinationBase = {
        bank_code: normalizedBankCode,
        account_number: params.accountNumber,
      }

      attempts.push(
        {
          path: '/api/v1/payout',
          body: {
            amount: amountMajor,
            currency: 'NGN',
            reference: params.reference,
            customer,
            destination: destinationBase,
            narration: params.reason,
          },
        },
        {
          path: '/api/v1/payout',
          body: {
            amount: amountMinor,
            currency: 'NGN',
            reference: params.reference,
            customer,
            destination: {
              ...destinationBase,
              account_name: params.accountName,
            },
            narration: params.reason,
          },
        },
        {
          path: '/api/v1/payout',
          body: {
            amount: amountMajor,
            currency: 'ngn',
            reference: params.reference,
            customer,
            destination: {
              ...destinationBase,
              account_name: params.accountName,
            },
            reason: params.reason,
          },
        },
        {
          path: '/api/v1/payout',
          body: {
            amount: amountMinor,
            currency: 'ngn',
            reference: params.reference,
            customer,
            destination: destinationBase,
            reason: params.reason,
          },
        }
      )
    }

    if (params.recipientCode) {
      attempts.push(
        {
          path: '/api/v1/payout',
          body: {
            amount: amountMajor,
            recipient: params.recipientCode,
            reference: params.reference,
            reason: params.reason,
            currency: 'ngn',
          },
        },
        {
          path: '/api/v1/payout',
          body: {
            amount: amountMinor,
            recipient: params.recipientCode,
            reference: params.reference,
            narration: params.reason,
            currency: 'ngn',
          },
        }
      )
    }

    let lastPayload: any = {}
    let firstMeaningfulFailure: any = null
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
        || pick<string>(data, ['id', '_id', 'reference', 'transaction_reference', 'transactionReference'])
        || pick<string>(payload, ['id', '_id', 'reference', 'transaction_reference', 'transactionReference'])

      const status = String(
        pick(data, ['status', 'transfer_status', 'transferStatus'])
        || pick(payload, ['status', 'transfer_status', 'transferStatus'])
        || ''
      ).toLowerCase()

      const boolStatus = pick<boolean>(payload, ['status'], false) === true
      const apiSuccess = result.ok || isSuccess(payload) || boolStatus
      const message = String(pick(payload, ['message', 'detail', 'error'], '') || '').toLowerCase()
      const explicitlyFailed = status === 'failed' || message.includes('failed')

      const ok = apiSuccess && !explicitlyFailed && Boolean(transferCode)
      if (ok) {
        return {
          success: true,
          transferCode,
          status,
          raw: payload,
        }
      }

      const notFoundMessage = String(pick(payload, ['message', 'error', 'detail', 'details'], '') || '').toLowerCase()
      const canRetryLowercaseCurrencyWalletError = (
        result.status === 400
        && notFoundMessage.includes('wallet not found for ngn')
        && String(attempt.body?.currency || '').toLowerCase() === 'ngn'
      )

      if (canRetryLowercaseCurrencyWalletError) {
        continue
      }

      if (result.status !== 404 || !notFoundMessage.includes('not found')) {
        firstMeaningfulFailure = {
          ...payload,
          _status: result.status,
          _path: attempt.path,
        }
        break
      }
    }

    const failurePayload = firstMeaningfulFailure || lastPayload
    const failureMessage = toErrorMessage(
      pick(failurePayload, ['message', 'error', 'detail', 'details']),
      'Unable to initiate transfer'
    )
    const failureStatus = Number(pick(failurePayload, ['_status'], 0))
    const failurePath = String(pick(failurePayload, ['_path'], '') || '')
    return {
      success: false,
      message: failurePath
        ? `${failureMessage} (HTTP ${failureStatus || 'unknown'} ${failurePath})`
        : failureMessage,
      raw: failurePayload,
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
