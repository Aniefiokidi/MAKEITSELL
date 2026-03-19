import { NextResponse } from 'next/server'

const PAYSTACK_BASE_URL = 'https://api.paystack.co'

const getPaystackSecret = () => {
  const key = String(process.env.PAYSTACK_SECRET_KEY || '').trim()
  if (!key || !key.startsWith('sk_')) {
    throw new Error('PAYSTACK_SECRET_KEY missing or invalid')
  }
  return key
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

    const secret = getPaystackSecret()
    const query = `account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`

    const response = await fetch(`${PAYSTACK_BASE_URL}/bank/resolve?${query}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secret}`,
      },
      cache: 'no-store',
    })

    const result = await response.json()
    const accountName = String(result?.data?.account_name || '').trim()

    if (!response.ok || !result?.status || !accountName) {
      const msg = result?.message || 'Failed to resolve account'
      return NextResponse.json({ success: false, error: msg }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      accountName,
      accountNumber,
      bankCode,
    })
  } catch (error: any) {
    console.error('[resolve-account] error', error)
    return NextResponse.json({ success: false, error: 'Failed to resolve account' }, { status: 500 })
  }
}
