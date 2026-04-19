import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: 'OTP phone resend is currently disabled. Please use email verification.',
    },
    { status: 410 }
  )
}