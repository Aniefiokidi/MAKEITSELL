import { NextRequest, NextResponse } from 'next/server'
import { xoroPayService } from '@/lib/xoro-pay'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { enforceRateLimit } from '@/lib/rate-limit'
import { enforceSameOrigin } from '@/lib/request-security'

const PAYSTACK_BASE_URL = 'https://api.paystack.co'
const denormalizeBankCodeForProvider = (code: string) => {
  const value = String(code || '').trim()
  if (value === '305' || value === '100004') return '999992'
  return value
}

const normalizeBankName = (value: string) =>
  String(value || '')
    .toLowerCase()
    .replace(/\(diamond\)/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const getPaystackSecret = () => {
  const key = String(process.env.PAYSTACK_SECRET_KEY || '').trim()
  return key && key.startsWith('sk_') ? key : ''
}

const resolveWithPaystack = async (bankCode: string, accountNumber: string) => {
  const secret = getPaystackSecret()
  if (!secret) {
    return { success: false, message: 'Paystack secret key unavailable' }
  }

  const query = `account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`
  const response = await fetch(`${PAYSTACK_BASE_URL}/bank/resolve?${query}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secret}`,
    },
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => ({}))
  const accountName = String(payload?.data?.account_name || '').trim()

  return {
    success: response.ok && Boolean(payload?.status) && Boolean(accountName),
    accountName,
    accountNumber,
    bankCode,
    message: payload?.message || 'Failed to resolve account from fallback provider',
  }
}

const fetchPaystackBanks = async () => {
  const secret = getPaystackSecret()
  if (!secret) {
    return { success: false, banks: [] as Array<{ name: string; code: string }>, message: 'Paystack secret key unavailable' }
  }

  const response = await fetch(`${PAYSTACK_BASE_URL}/bank?country=nigeria&currency=NGN`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secret}`,
    },
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => ({}))
  const banks = Array.isArray(payload?.data)
    ? payload.data
        .map((bank: any) => ({
          name: String(bank?.name || '').trim(),
          code: String(bank?.code || '').trim(),
        }))
        .filter((bank: { name: string; code: string }) => bank.name && bank.code)
    : []

  return {
    success: response.ok && Boolean(payload?.status) && banks.length > 0,
    banks,
    message: payload?.message || 'Failed to fetch banks from fallback provider',
  }
}

const resolveWithPaystackByBankName = async (bankName: string, accountNumber: string) => {
  const normalizedTarget = normalizeBankName(bankName)
  if (!normalizedTarget) {
    return { success: false, accountName: '', accountNumber, bankCode: '', message: 'Bank name unavailable for fallback resolution' }
  }

  const bankResult = await fetchPaystackBanks()
  if (!bankResult.success || bankResult.banks.length === 0) {
    return { success: false, accountName: '', accountNumber, bankCode: '', message: bankResult.message || 'Unable to fetch fallback bank list' }
  }

  const exact = bankResult.banks.find((bank: { name: string; code: string }) => normalizeBankName(bank.name) === normalizedTarget)
  const partial = bankResult.banks.find((bank: { name: string; code: string }) => {
    const normalized = normalizeBankName(bank.name)
    return normalizedTarget.includes(normalized) || normalized.includes(normalizedTarget)
  })

  const matched = exact || partial
  if (!matched) {
    return { success: false, accountName: '', accountNumber, bankCode: '', message: 'Unable to map selected bank for fallback verification' }
  }

  return resolveWithPaystack(matched.code, accountNumber)
}

const toFriendlyResolveError = (message: string) => {
  const normalized = String(message || '').toLowerCase()
  if (!normalized || normalized === 'not found') {
    return 'Unable to verify this account right now. Please confirm bank and account number, then try again.'
  }
  if (normalized.includes('could not resolve account')) {
    return 'Account details could not be verified. Please re-check bank and account number.'
  }
  return message
}

interface ResolveBody {
  bankCode?: string
  accountNumber?: string
  bankName?: string
}

export async function POST(req: NextRequest) {
  try {
    const originCheck = enforceSameOrigin(req)
    if (originCheck) return originCheck

    const rateLimitResponse = enforceRateLimit(req, {
      key: 'vendor-resolve-account',
      maxRequests: 30,
      windowMs: 60_000,
    })
    if (rateLimitResponse) return rateLimitResponse

    const sessionUser = await getSessionUserFromRequest(req)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as ResolveBody
    const bankCode = body.bankCode?.trim()
    const accountNumber = body.accountNumber?.trim()
    const bankName = body.bankName?.trim()

    if (!bankCode || !accountNumber) {
      return NextResponse.json({ success: false, error: 'bankCode and accountNumber are required' }, { status: 400 })
    }

    const normalizedForXoro = await xoroPayService.normalizeBankCodeForPayout(bankCode)
    const xoroCodes = Array.from(new Set([normalizedForXoro, bankCode]))
    let xoroResult: Awaited<ReturnType<typeof xoroPayService.resolveAccount>> | null = null
    for (const code of xoroCodes) {
      const attempt = await xoroPayService.resolveAccount(code, accountNumber)
      if (attempt.success && attempt.accountName) {
        xoroResult = attempt
        break
      }
      if (!xoroResult) {
        xoroResult = attempt
      }
    }

    if (xoroResult?.success && xoroResult.accountName) {
      return NextResponse.json({
        success: true,
        accountName: xoroResult.accountName,
        accountNumber: xoroResult.accountNumber || accountNumber,
        // Keep the UI-selected/provider code; payout path will normalize internally.
        bankCode,
      })
    }

    const paystackCodes = Array.from(new Set([bankCode, denormalizeBankCodeForProvider(bankCode)]))
    let fallbackResult: Awaited<ReturnType<typeof resolveWithPaystack>> | null = null
    for (const code of paystackCodes) {
      const attempt = await resolveWithPaystack(code, accountNumber)
      if (attempt.success && attempt.accountName) {
        fallbackResult = attempt
        break
      }
      if (!fallbackResult) {
        fallbackResult = attempt
      }
    }

    if ((!fallbackResult?.success || !fallbackResult.accountName) && bankName) {
      const byName = await resolveWithPaystackByBankName(bankName, accountNumber)
      if (byName.success && byName.accountName) {
        fallbackResult = byName
      }
    }

    if (!fallbackResult?.success || !fallbackResult.accountName) {
      return NextResponse.json(
        {
          success: false,
          error: toFriendlyResolveError(fallbackResult?.message || xoroResult?.message || 'Failed to resolve account'),
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      accountName: fallbackResult.accountName,
      accountNumber: fallbackResult.accountNumber,
      bankCode,
    })
  } catch (error: any) {
    console.error('[resolve-account] error', error)
    return NextResponse.json({ success: false, error: 'Failed to resolve account' }, { status: 500 })
  }
}
