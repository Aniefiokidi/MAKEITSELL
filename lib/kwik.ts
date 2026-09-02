// Kwik logistics API client — second delivery provider alongside Shipbubble
// (lib/shipbubble.ts). Docs: user-provided apikwik.apib (Kwik's own API Blueprint).
//
// Materially different auth model from Shipbubble's static bearer key: Kwik requires an
// email/password vendor login exchanged for an access_token (no documented TTL — cached
// conservatively via lib/cache-store and refreshed on any failed call, see withToken()).
// Pricing also needs raw lat/lng rather than a validated address string, so callers must
// geocode first (see lib/logistics/providers/kwik.ts, which uses lib/mapbox.ts for this).
//
// Fully inert until KWIK_ENABLED=true and every required env var is set (isKwikConfigured
// short-circuits every exported function to null/[]/false otherwise) — mirrors
// lib/shipbubble.ts's getApiKey() empty-check guard, so shipping this file changes nothing
// in production until deliberately turned on with real credentials.
//
// UNVERIFIED LIVE: no Kwik credentials exist yet to test against. Everything here is a
// careful trace against the doc's documented request/response JSON — two things in
// particular need confirming with Kwik once there's a real sandbox account:
//   1. `payment_method: 524288` (EOMB / wallet-priority) is Create Task's own worked
//      example, chosen here to mirror Shipbubble's "always paid via our own prepaid
//      wallet, never COD" convention — but Kwik's Pricing Logic section documents a
//      DIFFERENT code list (32 = card) for the same field, and the two sections disagree.
//   2. Whether `send_payment_for_task` truly has no side effects (it sits under "Pricing
//      Logic", separate from the actual "Create Task" endpoint, which is reassuring, but
//      the docs never say so explicitly).
import { getCachedPayload, setCachedPayload } from '@/lib/cache-store'

const DEFAULT_BASE_URL = 'https://staging-api-test.kwik.delivery'

function isKwikEnabled(): boolean {
  return String(process.env.KWIK_ENABLED || '').toLowerCase() === 'true'
}

function getConfig() {
  return {
    baseUrl: String(process.env.KWIK_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ''),
    domainName: String(process.env.KWIK_DOMAIN_NAME || '').trim(),
    email: String(process.env.KWIK_EMAIL || '').trim(),
    password: String(process.env.KWIK_PASSWORD || '').trim(),
    vendorId: String(process.env.KWIK_VENDOR_ID || '').trim(),
    userId: String(process.env.KWIK_USER_ID || '').trim(),
    formId: String(process.env.KWIK_FORM_ID || '').trim(),
    customFieldTemplate: String(process.env.KWIK_CUSTOM_FIELD_TEMPLATE || '').trim(),
    pickupCustomFieldTemplate: String(process.env.KWIK_PICKUP_CUSTOM_FIELD_TEMPLATE || '').trim(),
  }
}

export function isKwikConfigured(): boolean {
  if (!isKwikEnabled()) return false
  const c = getConfig()
  return Boolean(c.domainName && c.email && c.password && c.vendorId && c.userId && c.formId)
}

async function call<T = any>(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown } = {}
): Promise<{ ok: boolean; data: T | null; message: string; httpStatus: number }> {
  const { baseUrl } = getConfig()
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    })
    const json = await res.json().catch(() => ({}))
    const ok = res.ok && Number(json?.status) === 200
    return { ok, data: ok ? (json?.data ?? null) : null, message: String(json?.message || ''), httpStatus: res.status }
  } catch (error) {
    console.error(`[kwik] Request failed for ${path}:`, error)
    return { ok: false, data: null, message: 'Network error contacting Kwik', httpStatus: 0 }
  }
}

const ACCESS_TOKEN_CACHE_TTL_SECONDS = 12 * 60 * 60

async function kwikLogin(): Promise<string | null> {
  const c = getConfig()
  const result = await call<{ access_token: string }>('/vendor_login', {
    method: 'POST',
    body: { domain_name: c.domainName, email: c.email, password: c.password, api_login: 1 },
  })
  if (!result.ok || !result.data?.access_token) {
    console.error('[kwik] Login failed:', result.message)
    return null
  }
  return result.data.access_token
}

async function getAccessToken(forceRefresh = false): Promise<string | null> {
  if (!isKwikConfigured()) return null
  const cacheKey = 'v1'
  if (!forceRefresh) {
    const cached = await getCachedPayload<{ token: string }>('kwik-access-token', cacheKey)
    if (cached?.token) return cached.token
  }
  const token = await kwikLogin()
  if (!token) return null
  await setCachedPayload('kwik-access-token', cacheKey, { token }, ACCESS_TOKEN_CACHE_TTL_SECONDS)
  return token
}

// Retries once with a forced re-login if the first attempt fails — Kwik's docs don't
// specify a stable "expired token" error shape, so any failure is treated as worth one
// retry rather than trying to pattern-match a message that might not stay consistent.
async function withToken<T>(
  fn: (token: string) => Promise<{ ok: boolean; data: T | null; message: string; httpStatus: number }>
): Promise<{ ok: boolean; data: T | null; message: string }> {
  let token = await getAccessToken()
  if (!token) return { ok: false, data: null, message: 'Kwik is not configured or login failed' }

  let result = await fn(token)
  if (!result.ok) {
    token = await getAccessToken(true)
    if (token) result = await fn(token)
  }
  return result
}

// Nigeria (Africa/Lagos) is fixed UTC+1 year-round, no DST — safe to hardcode this offset
// rather than add a timezone-library dependency for one calculation.
const LAGOS_UTC_OFFSET_HOURS = 1
// Kwik's `timezone` field convention (per their docs' worked examples) is the negative of
// the UTC offset in minutes — e.g. IST (UTC+5:30) is sent as -330. Lagos (UTC+1) is -60.
export const KWIK_TIMEZONE_OFFSET = -(LAGOS_UTC_OFFSET_HOURS * 60)

function formatKwikDateTime(date: Date): string {
  const lagos = new Date(date.getTime() + LAGOS_UTC_OFFSET_HOURS * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${lagos.getUTCFullYear()}-${pad(lagos.getUTCMonth() + 1)}-${pad(lagos.getUTCDate())} ${pad(lagos.getUTCHours())}:${pad(lagos.getUTCMinutes())}:${pad(lagos.getUTCSeconds())}`
}

export type KwikVehicle = {
  vehicleId: number
  name: string
  size: number // 0=bike, 1=small, 2=medium, 3=large (per Kwik's /getVehicle docs)
  weightKg: number
}

export async function getKwikVehicles(): Promise<KwikVehicle[]> {
  if (!isKwikConfigured()) return []
  const cacheKey = 'v1'
  const cached = await getCachedPayload<KwikVehicle[]>('kwik-vehicles', cacheKey)
  if (cached) return cached

  const result = await withToken<any[]>((token) =>
    call(`/getVehicle?access_token=${encodeURIComponent(token)}&is_vendor=1`)
  )
  const list = Array.isArray(result.data) ? result.data : []
  const vehicles: KwikVehicle[] = list
    .map((v) => ({
      vehicleId: Number(v.vehicle_id),
      name: String(v.name || ''),
      size: Number(v.size),
      weightKg: Number(v.weight || 0),
    }))
    .filter((v) => Number.isFinite(v.vehicleId))

  if (vehicles.length > 0) {
    await setCachedPayload('kwik-vehicles', cacheKey, vehicles, 86400) // 24h — account-scoped reference data, matches the Shipbubble category cache pattern
  }
  return vehicles
}

export type KwikLocation = {
  address: string
  name: string
  latitude: number
  longitude: number
  phone: string
  email?: string
}

export type KwikPricingParams = {
  pickup: KwikLocation
  delivery: KwikLocation
  vehicleId: number
  deliveryInstruction?: string
}

export type KwikPricingResult = {
  netPayableAmount: number
  currency: string
  perTaskCost: string
  totalServiceCharge: number
  insuranceAmount: number
  totalNoOfTasks: number
  surgeCost: number
  surgeType: number
  deliveryInstruction: string
  vehicleId: number
}

// Two-step quote: send_payment_for_task computes the base task cost, then
// get_bill_breakdown folds in surge/VAT/etc. for the final payable number. Neither call
// is documented as creating a real task — that only happens via createKwikTask() below.
export async function calculateKwikPricing(params: KwikPricingParams): Promise<KwikPricingResult | null> {
  if (!isKwikConfigured()) return null
  const c = getConfig()
  const pickupTime = formatKwikDateTime(new Date())

  const priceResult = await withToken<any>((token) =>
    call('/send_payment_for_task', {
      method: 'POST',
      body: {
        custom_field_template: c.customFieldTemplate,
        pickup_custom_field_template: c.pickupCustomFieldTemplate,
        access_token: token,
        domain_name: c.domainName,
        vendor_id: Number(c.vendorId),
        user_id: Number(c.userId),
        form_id: Number(c.formId),
        auto_assignment: 1,
        layout_type: 0,
        has_pickup: 1,
        has_delivery: 1,
        is_multiple_tasks: 1,
        is_schedule_task: 0,
        payment_method: 524288,
        vehicle_id: params.vehicleId,
        delivery_instruction: params.deliveryInstruction || '',
        is_loader_required: 0,
        loaders_amount: 0,
        loaders_count: 0,
        is_cod_job: 0,
        parcel_amount: 0,
        pickups: [
          {
            address: params.pickup.address,
            name: params.pickup.name,
            latitude: params.pickup.latitude,
            longitude: params.pickup.longitude,
            time: pickupTime,
            phone: params.pickup.phone,
            email: params.pickup.email || '',
          },
        ],
        deliveries: [
          {
            address: params.delivery.address,
            name: params.delivery.name,
            latitude: params.delivery.latitude,
            longitude: params.delivery.longitude,
            time: pickupTime,
            phone: params.delivery.phone,
            email: params.delivery.email || '',
            has_return_task: false,
            is_package_insured: 0,
          },
        ],
      },
    })
  )
  if (!priceResult.ok || !priceResult.data) return null
  const priceData = priceResult.data

  const breakdownResult = await withToken<any>((token) =>
    call('/get_bill_breakdown', {
      method: 'POST',
      body: {
        access_token: token,
        benefit_type: null,
        amount: priceData.per_task_cost,
        insurance_amount: priceData.insurance_amount || 0,
        total_no_of_tasks: priceData.total_no_of_tasks || 1,
        pickup_time: pickupTime,
        user_id: Number(c.userId),
        form_id: Number(c.formId),
        promo_value: null,
        domain_name: c.domainName,
        credits: 0,
        total_service_charge: priceData.total_service_charge || 0,
        vehicle_id: params.vehicleId,
        delivery_images: priceData.delivery_images || '',
        is_loader_required: priceData.is_loader_required || 0,
        loaders_amount: priceData.loaders_amount || 0,
        loaders_count: priceData.loaders_count || 0,
        is_cod_job: priceData.is_cod_job || 0,
        parcel_amount: priceData.parcel_amount || 0,
        delivery_charge_by_buyer: 0,
        delivery_instruction: priceData.delivery_instruction || '',
      },
    })
  )
  if (!breakdownResult.ok || !breakdownResult.data) return null
  const b = breakdownResult.data

  return {
    netPayableAmount: Number(b.NET_PAYABLE_AMOUNT || 0),
    currency: String(priceData.currency?.code || 'NGN'),
    perTaskCost: String(priceData.per_task_cost || '0'),
    totalServiceCharge: Number(priceData.total_service_charge || 0),
    insuranceAmount: Number(priceData.insurance_amount || 0),
    totalNoOfTasks: Number(priceData.total_no_of_tasks || 1),
    surgeCost: Number(b.SURGE_PRICING || 0),
    surgeType: Number(b.SURGE_TYPE || 0),
    deliveryInstruction: String(priceData.delivery_instruction || ''),
    vehicleId: params.vehicleId,
  }
}

export type KwikTaskResult = {
  uniqueOrderId: string
  // Comma-joined pickup+delivery job_ids — NOT the same as uniqueOrderId. This is what
  // cancelKwikTask() needs; uniqueOrderId is just a human-facing reference.
  jobIds: string
  trackingUrl: string
  jobStatusCheckLink: string
}

// Kwik's pricing has no lock-in token like Shipbubble's request_token — the price quoted
// via calculateKwikPricing() could drift slightly (surge, etc.) by the time this actually
// runs. Accepted gap, called out in the plan; nothing to do about it without more from
// Kwik on quote-locking.
export async function createKwikTask(params: KwikPricingParams & { pricing: KwikPricingResult }): Promise<KwikTaskResult | null> {
  if (!isKwikConfigured()) return null
  const c = getConfig()
  const pickupTime = formatKwikDateTime(new Date())

  const result = await withToken<any>((token) =>
    call('/v2/create_task_via_vendor', {
      method: 'POST',
      body: {
        domain_name: c.domainName,
        access_token: token,
        vendor_id: Number(c.vendorId),
        is_multiple_tasks: 1,
        timezone: KWIK_TIMEZONE_OFFSET,
        has_pickup: 1,
        has_delivery: 1,
        layout_type: 0,
        auto_assignment: 1,
        pickups: [
          {
            address: params.pickup.address,
            name: params.pickup.name,
            latitude: params.pickup.latitude,
            longitude: params.pickup.longitude,
            time: pickupTime,
            phone: params.pickup.phone,
            email: params.pickup.email || '',
          },
        ],
        deliveries: [
          {
            address: params.delivery.address,
            name: params.delivery.name,
            latitude: params.delivery.latitude,
            longitude: params.delivery.longitude,
            time: pickupTime,
            phone: params.delivery.phone,
            email: params.delivery.email || '',
            has_return_task: false,
            is_package_insured: 0,
            hadVairablePayment: 1,
            hadFixedPayment: 0,
          },
        ],
        insurance_amount: params.pricing.insuranceAmount,
        total_no_of_tasks: params.pricing.totalNoOfTasks,
        total_service_charge: params.pricing.totalServiceCharge,
        payment_method: 524288,
        amount: params.pricing.perTaskCost,
        surge_cost: params.pricing.surgeCost,
        surge_type: params.pricing.surgeType,
        delivery_instruction: params.pricing.deliveryInstruction,
        loaders_amount: 0,
        loaders_count: 0,
        is_loader_required: 0,
        delivery_images: '',
        vehicle_id: params.pricing.vehicleId,
        is_cod_job: 0,
      },
    })
  )
  if (!result.ok || !result.data?.unique_order_id) return null
  const data = result.data

  const jobIds = [...(data.pickups || []), ...(data.deliveries || [])]
    .map((j: any) => j?.job_id)
    .filter((id: any) => id != null)
    .join(',')
  const trackingUrl = String(data.deliveries?.[0]?.result_tracking_link || data.pickups?.[0]?.result_tracking_link || '')

  return {
    uniqueOrderId: String(data.unique_order_id),
    jobIds,
    trackingUrl,
    jobStatusCheckLink: String(data.job_status_check_link || ''),
  }
}

export async function cancelKwikTask(jobIds: string): Promise<boolean> {
  if (!isKwikConfigured() || !jobIds) return false
  const c = getConfig()
  const result = await withToken<any>((token) =>
    call('/cancel_vendor_task', {
      method: 'POST',
      body: { access_token: token, vendor_id: Number(c.vendorId), job_id: jobIds, job_status: 9, domain_name: c.domainName },
    })
  )
  return result.ok
}
