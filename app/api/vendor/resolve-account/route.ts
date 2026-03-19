import { NextResponse } from 'next/server'
import { xoroPayService } from '@/lib/xoro-pay'

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

    const result = await xoroPayService.resolveAccount(bankCode, accountNumber)
    if (!result.success || !result.accountName) {
      const msg = result.message || 'Failed to resolve account'
      return NextResponse.json({ success: false, error: msg }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      accountName: result.accountName,
      accountNumber: result.accountNumber || accountNumber,
      bankCode: result.bankCode || bankCode,
    })
  } catch (error: any) {
    console.error('[resolve-account] error', error)
    return NextResponse.json({ success: false, error: 'Failed to resolve account' }, { status: 500 })
  }
}
