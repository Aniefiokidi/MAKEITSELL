import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'Phone verification is currently disabled. Please use email verification.',
    },
    { status: 410 }
  )
}