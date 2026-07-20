import { NextRequest, NextResponse } from 'next/server'

type RateLimitConfig = {
  key: string
  maxRequests: number
  windowMs: number
}

// Same dual-mode pattern as lib/cache-store.ts: Redis-backed (real limit, shared across
// every serverless instance) when Upstash is configured, in-memory fallback otherwise —
// which only limits within a single warm instance and resets on every cold start, so it
// was always a soft deterrent, not a real limit, prior to this.
const REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_REST_URL || ''
const REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_REST_TOKEN || ''
const hasRedis = Boolean(REDIS_REST_URL && REDIS_REST_TOKEN)

type Bucket = { count: number; resetAt: number }
const memoryBuckets = new Map<string, Bucket>()

const getClientIp = (request: NextRequest) => {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return request.headers.get('x-real-ip') || 'unknown'
}

const buildRedisUrl = (path: string) => `${REDIS_REST_URL.replace(/\/$/, '')}${path}`

async function redisCommand(path: string): Promise<any | null> {
  try {
    const response = await fetch(buildRedisUrl(path), {
      method: 'GET',
      headers: { Authorization: `Bearer ${REDIS_REST_TOKEN}` },
      cache: 'no-store',
    })
    if (!response.ok) return null
    return await response.json().catch(() => null)
  } catch {
    return null
  }
}

function tooManyRequestsResponse(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { success: false, error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: { 'Retry-After': String(Math.max(1, Math.ceil(retryAfterSeconds))) },
    }
  )
}

function enforceMemoryRateLimit(bucketKey: string, config: RateLimitConfig): NextResponse | null {
  const now = Date.now()
  const existing = memoryBuckets.get(bucketKey)

  if (!existing || existing.resetAt <= now) {
    memoryBuckets.set(bucketKey, { count: 1, resetAt: now + config.windowMs })
    return null
  }

  if (existing.count >= config.maxRequests) {
    return tooManyRequestsResponse((existing.resetAt - now) / 1000)
  }

  existing.count += 1
  memoryBuckets.set(bucketKey, existing)
  return null
}

// Fixed-window counter via Redis INCR + EXPIRE — INCR is atomic, so concurrent requests
// from the same bucket can't race each other into undercounting the way a naive
// get-then-set implementation would.
async function enforceRedisRateLimit(bucketKey: string, config: RateLimitConfig): Promise<NextResponse | null> {
  const windowSeconds = Math.max(1, Math.ceil(config.windowMs / 1000))
  const redisKey = `ratelimit:${bucketKey}`

  const incrResult = await redisCommand(`/incr/${encodeURIComponent(redisKey)}`)
  const count = Number(incrResult?.result)

  if (!Number.isFinite(count)) {
    // Redis call failed (network blip, bad credentials, etc.) — fail over to the
    // in-memory limiter rather than either blocking every request or silently allowing
    // unlimited ones.
    return enforceMemoryRateLimit(bucketKey, config)
  }

  if (count === 1) {
    // First hit in this window — start the expiry clock so the counter resets.
    void redisCommand(`/expire/${encodeURIComponent(redisKey)}/${windowSeconds}`)
  }

  if (count > config.maxRequests) {
    const ttlResult = await redisCommand(`/ttl/${encodeURIComponent(redisKey)}`)
    const ttl = Number(ttlResult?.result)
    return tooManyRequestsResponse(Number.isFinite(ttl) && ttl > 0 ? ttl : windowSeconds)
  }

  return null
}

export const enforceRateLimit = async (
  request: NextRequest,
  config: RateLimitConfig
): Promise<NextResponse | null> => {
  const ip = getClientIp(request)
  const bucketKey = `${config.key}:${ip}`

  if (hasRedis) {
    return enforceRedisRateLimit(bucketKey, config)
  }

  return enforceMemoryRateLimit(bucketKey, config)
}
