export type SmsSendResult = {
  ok: boolean
  errorMessage?: string
  payload?: any
}

type SendchampStatusResult = {
  ok: boolean
  errorMessage?: string
  payload?: any
}

function getSendchampConfig() {
  const baseUrl = String(process.env.SENDCHAMP_BASE_URL || 'https://api.sendchamp.com/api/v1')
    .trim()
    .replace(/\/$/, '')
  const apiKey = String(process.env.SENDCHAMP_API_KEY || '').trim()
  const sender = String(process.env.SENDCHAMP_SENDER || 'SAlert').trim()
  const route = String(process.env.SENDCHAMP_ROUTE || 'non_dnd').trim().toLowerCase()

  return { baseUrl, apiKey, sender, route }
}

export function normalizeNigerianPhone(input: string): string | null {
  const raw = String(input || '').trim()
  if (!raw) return null

  if (raw.startsWith('+')) {
    const plusNormalizedDigits = raw.replace(/\D/g, '')
    if (plusNormalizedDigits.length >= 8 && plusNormalizedDigits.length <= 15) {
      return `+${plusNormalizedDigits}`
    }
    return null
  }

  const digits = raw.replace(/\D/g, '')

  if (digits.startsWith('00') && digits.length > 8) {
    const internationalDigits = digits.slice(2)
    if (internationalDigits.length >= 8 && internationalDigits.length <= 15) {
      return `+${internationalDigits}`
    }
  }

  if (digits.length === 10 && /^[7-9]\d{9}$/.test(digits)) {
    return `+234${digits}`
  }

  if (digits.startsWith('0') && digits.length === 11) {
    return `+234${digits.slice(1)}`
  }

  if (digits.startsWith('234') && digits.length === 13) {
    return `+${digits}`
  }

  if (raw.startsWith('+234') && digits.length === 13) {
    return `+${digits}`
  }

  return null
}

function toSendchampPhone(phone: string): string {
  return String(phone || '').trim().replace(/^\+/, '')
}

function extractSendchampSmsUid(payload: any): string {
  const candidates = [
    payload?.data?.sms_uid,
    payload?.data?.uid,
    payload?.data?.message_uid,
    payload?.sms_uid,
    payload?.uid,
    payload?.message_uid,
  ]

  for (const candidate of candidates) {
    const value = String(candidate || '').trim()
    if (value) return value
  }

  return ''
}

async function sendSendchampSms({
  to,
  message,
  sender,
}: {
  to: string[]
  message: string
  sender?: string
}): Promise<SmsSendResult> {
  try {
    const config = getSendchampConfig()
    if (!config.apiKey) {
      return { ok: false, errorMessage: 'SENDCHAMP_API_KEY is not configured on the server.' }
    }

    const response = await fetch(`${config.baseUrl}/sms/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        to,
        message,
        sender_name: String(sender || config.sender).trim() || config.sender,
        route: config.route,
      }),
    })

    const payload = await response.json().catch(() => ({}))
    const accepted = response.ok && !payload?.error

    if (!accepted) {
      return {
        ok: false,
        payload,
        errorMessage: String(payload?.message || payload?.error || `HTTP ${response.status}`),
      }
    }

    return { ok: true, payload }
  } catch (error: any) {
    return { ok: false, errorMessage: error?.message || 'SMS request failed' }
  }
}

export async function getSendchampSmsDeliveryStatus(smsUid: string): Promise<SendchampStatusResult> {
  try {
    const config = getSendchampConfig()
    if (!config.apiKey) {
      return { ok: false, errorMessage: 'SENDCHAMP_API_KEY is not configured on the server.' }
    }

    const normalizedUid = String(smsUid || '').trim()
    if (!normalizedUid) {
      return { ok: false, errorMessage: 'SMS UID is required.' }
    }

    const response = await fetch(`${config.baseUrl}/sms/status/${encodeURIComponent(normalizedUid)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      return {
        ok: false,
        payload,
        errorMessage: String(payload?.message || payload?.error || `HTTP ${response.status}`),
      }
    }

    return { ok: true, payload }
  } catch (error: any) {
    return { ok: false, errorMessage: error?.message || 'Failed to fetch SMS delivery status' }
  }
}

async function sendTransactionalSms({
  phoneNumber,
  sms,
  sender,
}: {
  phoneNumber: string
  sms: string
  sender?: string
}): Promise<SmsSendResult> {
  const normalizedPhone = normalizeNigerianPhone(phoneNumber)
  if (!normalizedPhone) {
    return { ok: false, errorMessage: 'Invalid phone number.' }
  }

  return sendSendchampSms({
    to: [toSendchampPhone(normalizedPhone)],
    message: sms,
    sender,
  })
}

export async function sendOtpSms(phoneNumber: string, otpCode: string): Promise<SmsSendResult> {
  return sendTransactionalSms({
    phoneNumber,
    sms: `Your Make It Sell OTP is ${String(otpCode || '').trim()}`,
  })
}

export async function sendOrderConfirmationSms({
  phoneNumber,
  orderId,
  amount,
  productSubtotal,
  deliveryFee,
  recipient = 'customer',
  itemCount,
  counterpartyName,
  deliveryCity,
}: {
  phoneNumber: string
  orderId: string
  amount: number
  productSubtotal?: number
  deliveryFee?: number
  recipient?: 'customer' | 'vendor'
  itemCount?: number
  counterpartyName?: string
  deliveryCity?: string
}): Promise<SmsSendResult> {
  const shortOrderId = String(orderId).slice(0, 8).toUpperCase()
  const totalAmount = Number(amount || 0)
  const itemAmount = Number.isFinite(Number(productSubtotal)) ? Number(productSubtotal) : totalAmount
  const deliveryAmount = Number.isFinite(Number(deliveryFee)) ? Number(deliveryFee) : Math.max(0, totalAmount - itemAmount)

  const amountText = `NGN ${totalAmount.toLocaleString('en-NG')}`
  const productPriceText = `NGN ${itemAmount.toLocaleString('en-NG')}`
  const deliveryPriceText = deliveryAmount > 0 ? `NGN ${deliveryAmount.toLocaleString('en-NG')}` : 'FREE'
  const qtyText = Number.isFinite(Number(itemCount)) && Number(itemCount) > 0 ? `${Number(itemCount)} item(s), ` : ''

  const sms = recipient === 'vendor'
    ? `New order ${shortOrderId}: ${qtyText}Total ${amountText}, Product ${productPriceText}, Delivery ${deliveryPriceText} from ${String(counterpartyName || 'customer').trim()}. Check dashboard.`
    : `Order confirmed ${shortOrderId}: ${qtyText}Total ${amountText}, Product ${productPriceText}, Delivery ${deliveryPriceText}${deliveryCity ? `, delivery to ${deliveryCity}` : ''}.`

  return sendTransactionalSms({
    phoneNumber,
    sms,
  })
}

export async function sendBookingConfirmationSms({
  phoneNumber,
  bookingId,
  serviceTitle,
  bookingDate,
  startTime,
  endTime,
  totalPrice,
  recipient = 'customer',
  counterpartyName,
  status = 'confirmed',
}: {
  phoneNumber: string
  bookingId?: string
  serviceTitle: string
  bookingDate: Date
  startTime: string
  endTime?: string
  totalPrice?: number
  recipient?: 'customer' | 'provider'
  counterpartyName?: string
  status?: 'pending' | 'confirmed'
}): Promise<SmsSendResult> {
  const dateText = new Date(bookingDate).toLocaleDateString('en-NG')
  const bookingRef = bookingId ? `#${String(bookingId).slice(0, 8).toUpperCase()}` : ''
  const timeText = endTime ? `${startTime}-${endTime}` : startTime
  const amountText = Number.isFinite(Number(totalPrice)) ? `, NGN ${Number(totalPrice || 0).toLocaleString('en-NG')}` : ''

  let sms = ''
  if (status === 'pending') {
    sms = recipient === 'provider'
      ? `New booking request ${bookingRef}: ${serviceTitle} on ${dateText} ${timeText}${amountText} from ${String(counterpartyName || 'customer').trim()}.`
      : `Booking request received ${bookingRef}: ${serviceTitle} on ${dateText} ${timeText}${amountText}. We will notify you once it is confirmed.`
  } else {
    sms = recipient === 'provider'
      ? `Booking confirmed ${bookingRef}: ${serviceTitle} on ${dateText} ${timeText}${amountText} for ${String(counterpartyName || 'customer').trim()}.`
      : `Booking confirmed ${bookingRef}: ${serviceTitle} on ${dateText} ${timeText}${amountText}.`
  }

  return sendTransactionalSms({
    phoneNumber,
    sms,
  })
}

export async function sendCustomSms({
  phoneNumber,
  message,
}: {
  phoneNumber: string
  message: string
}): Promise<SmsSendResult> {
  const normalizedMessage = String(message || '').trim()
  return sendTransactionalSms({
    phoneNumber,
    sms: normalizedMessage,
  })
}

export function getSmsUidFromPayload(payload: any): string {
  return extractSendchampSmsUid(payload)
}
