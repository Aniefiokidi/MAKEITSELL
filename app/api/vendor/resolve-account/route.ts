import { NextResponse } from 'next/server'
import { xoroPayService } from '@/lib/xoro-pay'

const PAYSTACK_BASE_URL = 'https://api.paystack.co'
const denormalizeBankCodeForProvider = (code: string) => {
  const value = String(code || '').trim()
  if (value === '305' || value === '100004') return '999992'
  return value
}

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

interface ResolveBody {
  bankCode?: string
  accountNumber?: string
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ResolveBody
    const bankCode = body.bankCode?.trim()
    const accountNumber = body.accountNumber?.trim()

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

    if (!fallbackResult?.success || !fallbackResult.accountName) {
      return NextResponse.json(
        { success: false, error: xoroResult?.message || fallbackResult?.message || 'Failed to resolve account' },
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
