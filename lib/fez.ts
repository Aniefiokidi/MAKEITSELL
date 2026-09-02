// Fez Delivery API client — third logistics provider alongside Shipbubble
// (lib/shipbubble.ts) and Kwik (lib/kwik.ts). Docs:
// https://fez-delivery-co.gitbook.io/fezcorporate-api-docs/
//
// THIS IS A REAL PRODUCTION ACCOUNT (org: MAKE IT SELL), not a sandbox — confirmed via
// FEZ_BASE_URL=https://api.fezdelivery.co/v1. createFezOrder() and cancelFezOrder() are
// real, billable, live courier actions. Never call them outside the real checkout/
// cancellation flow — there is no free "test order" concept here the way
// TEST_STORE_VENDOR_ID gives Shipbubble/Kwik.
//
// Auth is a two-step model: a stable, long-lived `secret-key` (FEZ_SECRET_KEY, shown on
// the org's dashboard) sent on every request, PLUS a short-lived JWT `authToken`
// obtained by logging in with FEZ_USER_ID/FEZ_PASSWORD via /user/authenticate — confirmed
// live to expire after exactly 3 hours (iat/exp diff), so it's cached for a bit under
// that and refreshed on any failed call, same withToken() retry pattern as lib/kwik.ts.
//
// Simpler surface than both other providers: no address validation/geocoding step at
// all — Fez just takes address strings directly, and delivery cost is a single call
// keyed on destination state + weight (no per-courier options to choose between; Fez IS
// the courier). Fully inert until FEZ_ENABLED=true and every required env var is set.
import { getCachedPayload, setCachedPayload } from '@/lib/cache-store'
import crypto from 'crypto'

const DEFAULT_BASE_URL = 'https://api.fezdelivery.co/v1'

function isFezEnabled(): boolean {
  return String(process.env.FEZ_ENABLED || '').toLowerCase() === 'true'
}

function getConfig() {
  return {
    baseUrl: String(process.env.FEZ_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ''),
    userId: String(process.env.FEZ_USER_ID || '').trim(),
    password: String(process.env.FEZ_PASSWORD || '').trim(),
    secretKey: String(process.env.FEZ_SECRET_KEY || '').trim(),
  }
}

export function isFezConfigured(): boolean {
  if (!isFezEnabled()) return false
  const c = getConfig()
  return Boolean(c.userId && c.password && c.secretKey)
}

async function call<T = any>(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown; headers?: Record<string, string> } = {}
): Promise<{ ok: boolean; data: T | null; message: string; httpStatus: number }> {
  const { baseUrl } = getConfig()
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    })
    const json = await res.json().catch(() => ({}))
    const ok = res.ok && String(json?.status || '').toLowerCase() === 'success'
    return { ok, data: ok ? (json as T) : null, message: String(json?.description || ''), httpStatus: res.status }
  } catch (error) {
    console.error(`[fez] Request failed for ${path}:`, error)
    return { ok: false, data: null, message: 'Network error contacting Fez', httpStatus: 0 }
  }
}

// Confirmed live: authToken expires exactly 3 hours after login. Cached for a bit under
// that so a request never hits Fez with an already-expired token.
const ACCESS_TOKEN_CACHE_TTL_SECONDS = 2.5 * 60 * 60

async function fezLogin(): Promise<string | null> {
  const c = getConfig()
  const result = await call<{ authDetails: { authToken: string } }>('/user/authenticate', {
    method: 'POST',
    body: { user_id: c.userId, password: c.password },
  })
  if (!result.ok || !result.data?.authDetails?.authToken) {
    console.error('[fez] Login failed:', result.message)
    return null
  }
  return result.data.authDetails.authToken
}

async function getAccessToken(forceRefresh = false): Promise<string | null> {
  if (!isFezConfigured()) return null
  const cacheKey = 'v1'
  if (!forceRefresh) {
    const cached = await getCachedPayload<{ token: string }>('fez-access-token', cacheKey)
    if (cached?.token) return cached.token
  }
  const token = await fezLogin()
  if (!token) return null
  await setCachedPayload('fez-access-token', cacheKey, { token }, ACCESS_TOKEN_CACHE_TTL_SECONDS)
  return token
}

async function withAuth<T>(
  fn: (token: string) => Promise<{ ok: boolean; data: T | null; message: string; httpStatus: number }>
): Promise<{ ok: boolean; data: T | null; message: string }> {
  let token = await getAccessToken()
  if (!token) return { ok: false, data: null, message: 'Fez is not configured or login failed' }

  let result = await fn(token)
  if (!result.ok) {
    token = await getAccessToken(true)
    if (token) result = await fn(token)
  }
  return result
}

function authHeaders(token: string): Record<string, string> {
  const c = getConfig()
  return { Authorization: `Bearer ${token}`, 'secret-key': c.secretKey }
}

export type FezDeliveryCost = {
  totalCost: number
  currency: string
}

// totalCost already folds VAT + fuel surcharge in — confirmed live against the real
// account (totalCost = cost.cost [VAT-inclusive] + surcharge.totalAmount). Use it
// directly; don't try to reconstruct it from the sub-fields.
export async function getFezDeliveryCost(state: string, weightKg: number): Promise<FezDeliveryCost | null> {
  if (!isFezConfigured()) return null
  const result = await withAuth<any>((token) =>
    call('/order/cost', { method: 'POST', headers: authHeaders(token), body: { state, weight: weightKg } })
  )
  if (!result.ok || !result.data) return null
  const totalCost = Number(result.data.totalCost)
  if (!Number.isFinite(totalCost)) return null
  return { totalCost, currency: 'NGN' }
}

export type FezOrderInput = {
  uniqueID: string
  batchID: string
  recipientName: string
  recipientPhone: string
  recipientEmail?: string
  recipientAddress: string
  recipientState: string
  senderName: string
  senderPhone: string
  senderAddress: string
  itemDescription: string
  valueOfItem: number
  weightKg: number
}

export type FezOrderResult = {
  orderNo: string
}

// REAL, LIVE, BILLABLE — creates an actual courier pickup on the production account.
export async function createFezOrder(input: FezOrderInput): Promise<FezOrderResult | null> {
  if (!isFezConfigured()) return null
  const result = await withAuth<{ orderNos: Record<string, string> }>((token) =>
    call('/order', {
      method: 'POST',
      headers: authHeaders(token),
      body: [
        {
          uniqueID: input.uniqueID,
          BatchID: input.batchID,
          recipientName: input.recipientName,
          recipientPhone: input.recipientPhone,
          recipientEmail: input.recipientEmail || undefined,
          recipientAddress: input.recipientAddress,
          recipientState: input.recipientState,
          thirdparty: true,
          senderName: input.senderName,
          senderPhone: input.senderPhone,
          senderAddress: input.senderAddress,
          itemDescription: input.itemDescription,
          valueOfItem: String(input.valueOfItem),
          weight: Math.max(1, Math.ceil(input.weightKg)),
          fragile: false,
          isItemCod: false,
        },
      ],
    })
  )
  if (!result.ok || !result.data?.orderNos) return null
  const orderNo = result.data.orderNos[input.uniqueID]
  return orderNo ? { orderNo } : null
}

// REAL, LIVE — cancels an actual dispatched/pending courier task.
export async function cancelFezOrder(orderNo: string, reason: string): Promise<boolean> {
  if (!isFezConfigured() || !orderNo) return false
  const result = await withAuth<any>((token) =>
    call('/order/cancel', { method: 'POST', headers: authHeaders(token), body: { orderNo, reason: reason.slice(0, 255) } })
  )
  return result.ok
}

export async function trackFezOrder(orderNo: string): Promise<any | null> {
  if (!isFezConfigured() || !orderNo) return null
  const result = await withAuth<any>((token) =>
    call(`/order/track/${encodeURIComponent(orderNo)}`, { method: 'GET', headers: authHeaders(token) })
  )
  return result.ok ? result.data : null
}

// One-time account setup, not a per-order call — points Fez at our webhook route so
// order-status pushes arrive without polling. Safe to re-run; Fez's response shows the
// currently-registered webhook list either way.
export async function registerFezWebhook(url: string): Promise<boolean> {
  if (!isFezConfigured()) return false
  const result = await withAuth<any>((token) =>
    call('/webhooks/store', { method: 'POST', headers: authHeaders(token), body: { webhook: url } })
  )
  return result.ok
}

// Per Fez's docs: X-Signature is HMAC-SHA256(orderNo + orderStatus + timestamp) signed
// with the org's secret-key. X-Timestamp is meant to prevent replay — reject anything
// older than 5 minutes rather than trusting an arbitrarily old signed payload.
const WEBHOOK_MAX_AGE_SECONDS = 5 * 60

export function verifyFezWebhookSignature(params: {
  orderNo: string
  orderStatus: string
  timestamp: string
  signatureHeader: string | null
}): boolean {
  const { orderNo, orderStatus, timestamp, signatureHeader } = params
  if (!signatureHeader || !timestamp) return false

  const timestampNum = Number(timestamp)
  if (!Number.isFinite(timestampNum) || Math.abs(Date.now() / 1000 - timestampNum) > WEBHOOK_MAX_AGE_SECONDS) return false

  const c = getConfig()
  const expected = crypto.createHmac('sha256', c.secretKey).update(`${orderNo}${orderStatus}${timestamp}`).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader))
  } catch {
    return false
  }
}
