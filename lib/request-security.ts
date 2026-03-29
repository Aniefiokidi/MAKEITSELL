import { NextRequest, NextResponse } from 'next/server'

const normalizeOrigin = (value: string) => value.replace(/\/$/, '').toLowerCase()

export const enforceSameOrigin = (request: NextRequest): NextResponse | null => {
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')

  // Non-browser or same-site requests may omit Origin; allow to avoid breaking valid flows.
  if (!origin) return null
  if (!host) {
    return NextResponse.json({ success: false, error: 'Forbidden request origin' }, { status: 403 })
  }

  const expected = `${request.nextUrl.protocol}//${host}`
  if (normalizeOrigin(origin) !== normalizeOrigin(expected)) {
    return NextResponse.json({ success: false, error: 'Forbidden request origin' }, { status: 403 })
  }

  return null
}
