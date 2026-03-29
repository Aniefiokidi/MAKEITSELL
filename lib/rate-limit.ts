import { NextRequest, NextResponse } from 'next/server'

type Bucket = {
  count: number
  resetAt: number
}

type RateLimitConfig = {
  key: string
  maxRequests: number
  windowMs: number
}

const buckets = new Map<string, Bucket>()

const getClientIp = (request: NextRequest) => {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    return xff.split(',')[0].trim()
  }
  return request.headers.get('x-real-ip') || 'unknown'
}

export const enforceRateLimit = (request: NextRequest, config: RateLimitConfig): NextResponse | null => {
  const now = Date.now()
  const ip = getClientIp(request)
  const bucketKey = `${config.key}:${ip}`

  const existing = buckets.get(bucketKey)
  if (!existing || existing.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + config.windowMs })
    return null
  }

  if (existing.count >= config.maxRequests) {
    const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
        },
      }
    )
  }

  existing.count += 1
  buckets.set(bucketKey, existing)
  return null
}
