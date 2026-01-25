import { NextResponse } from 'next/server'

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

    const secret = process.env.PAYSTACK_SECRET_KEY
    if (!secret) {
      return NextResponse.json({ success: false, error: 'PAYSTACK_SECRET_KEY missing' }, { status: 500 })
    }

    const url = `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${secret}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    const data = await res.json()
    if (!res.ok || data?.status === false) {
      const msg = data?.message || 'Failed to resolve account'
      return NextResponse.json({ success: false, error: msg }, { status: 400 })
    }

    return NextResponse.json({ success: true, accountName: data?.data?.account_name, accountNumber: data?.data?.account_number, bankCode })
  } catch (error: any) {
    console.error('[resolve-account] error', error)
    return NextResponse.json({ success: false, error: 'Failed to resolve account' }, { status: 500 })
  }
}
