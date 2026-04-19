import { sendWatiSessionMessage, sendWatiTemplateMessage } from './wati'

export type SmsSendResult = {
  ok: boolean
  errorMessage?: string
  payload?: any
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

function toTermiiFormat(phone: string): string {
  return String(phone || '').trim().replace(/^\+/, '')
}

function getSenderCandidates(primary?: string): string[] {
  const configuredPrimary = String(primary || process.env.TERMII_SENDER || 'N-Alert').trim()
  const configuredFallback = String(process.env.TERMII_SENDER_FALLBACK || 'MakeItSell').trim()
  return Array.from(new Set([configuredPrimary, configuredFallback].filter(Boolean)))
}

function getChannelCandidates(preferred: string, includeDndFallback = true): Array<'generic' | 'dnd'> {
  const normalizedPreferred = String(preferred || '').trim().toLowerCase()
  const base: Array<'generic' | 'dnd'> = normalizedPreferred === 'dnd' ? ['dnd', 'generic'] : ['generic', 'dnd']
  if (!includeDndFallback) {
    return [base[0]]
  }
  return Array.from(new Set(base))
}

async function sendWhatsappIfConfigured({
  phoneNumber,
  message,
  templateName,
  templateParams,
}: {
  phoneNumber: string
  message: string
  templateName?: string
  templateParams?: Array<{ name: string; value: string }>
}): Promise<SmsSendResult | null> {
  const watiEnabled = String(process.env.WATI_ENABLED || 'false').trim().toLowerCase() === 'true'
  if (!watiEnabled) return null

  const resolvedTemplateName = String(templateName || '').trim()

  if (resolvedTemplateName) {
    const templateResult = await sendWatiTemplateMessage({
      phoneNumber,
      templateName: resolvedTemplateName,
      parameters: templateParams || [],
    })

    if (!templateResult.ok) {
      console.warn('[wati] Template message failed:', templateResult.errorMessage || templateResult.payload)
    }
    return {
      ok: templateResult.ok,
      errorMessage: templateResult.errorMessage,
      payload: templateResult.payload,
    }
  }

  const sessionResult = await sendWatiSessionMessage({
    phoneNumber,
    message,
  })

  if (!sessionResult.ok) {
    console.warn('[wati] Session message failed:', sessionResult.errorMessage || sessionResult.payload)
  }

  return {
    ok: sessionResult.ok,
    errorMessage: sessionResult.errorMessage,
    payload: sessionResult.payload,
  }
}

async function sendTermiiSms({
  to,
  sms,
  sender,
  channel,
}: {
  to: string
  sms: string
  sender: string
  channel: 'generic' | 'dnd'
}): Promise<SmsSendResult> {
  try {
    const apiKey = String(process.env.TERMII_API_KEY || '').trim()
    const baseUrl = String(process.env.TERMII_BASE_URL || 'https://v3.api.termii.com').replace(/\/$/, '')

    if (!apiKey) {
      return { ok: false, errorMessage: 'TERMII_API_KEY is not configured on the server.' }
    }

    const response = await fetch(`${baseUrl}/api/sms/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: toTermiiFormat(to),
        from: sender,
        sms,
        type: 'plain',
        channel,
        api_key: apiKey,
      }),
    })

    const payload = await response.json().catch(() => ({}))
    const apiAccepted = payload?.status === 'success' || payload?.status === true || payload?.code === 'ok'

    if (!response.ok || !apiAccepted) {
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

async function sendOtpVoiceFallback(phoneNumber: string, otpCode: string): Promise<SmsSendResult> {
  try {
    const apiKey = String(process.env.TERMII_API_KEY || '').trim()
    const baseUrl = String(process.env.TERMII_BASE_URL || 'https://v3.api.termii.com').replace(/\/$/, '')
    if (!apiKey) {
      return { ok: false, errorMessage: 'TERMII_API_KEY is not configured on the server.' }
    }

    const response = await fetch(`${baseUrl}/api/sms/otp/send/voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        phone_number: toTermiiFormat(phoneNumber),
        pin_attempts: 3,
        pin_time_to_live: 6,
        pin_length: 5,
      }),
    })

    const payload = await response.json().catch(() => ({}))
    const accepted = !!payload?.pinId || response.ok

    if (!accepted) {
      return {
        ok: false,
        payload,
        errorMessage: String(payload?.message || payload?.error || `HTTP ${response.status}`),
      }
    }

    return { ok: true, payload }
  } catch (error: any) {
    return { ok: false, errorMessage: error?.message || 'Voice OTP request failed' }
  }
}

async function sendTransactionalSms({
  phoneNumber,
  sms,
  sender,
  whatsappTemplateName,
  whatsappTemplateParams,
}: {
  phoneNumber: string
  sms: string
  sender?: string
  whatsappTemplateName?: string
  whatsappTemplateParams?: Array<{ name: string; value: string }>
}): Promise<SmsSendResult> {
  const normalizedPhone = normalizeNigerianPhone(phoneNumber)
  if (!normalizedPhone) {
    return { ok: false, errorMessage: 'Invalid phone number.' }
  }

  const whatsappResult = await sendWhatsappIfConfigured({
    phoneNumber: normalizedPhone,
    message: sms,
    templateName: whatsappTemplateName,
    templateParams: whatsappTemplateParams,
  })

  if (whatsappResult?.ok) {
    return {
      ok: true,
      payload: {
        ...(whatsappResult.payload || {}),
        channel: 'whatsapp',
      },
    }
  }

  const senderCandidates = getSenderCandidates(sender)
  const channelCandidates = getChannelCandidates(String(process.env.TERMII_TRANSACTIONAL_CHANNEL || 'generic'))

  let lastFailure: SmsSendResult = { ok: false, errorMessage: 'Failed to send transactional SMS.' }
  for (const senderId of senderCandidates) {
    for (const channel of channelCandidates) {
      const result = await sendTermiiSms({
        to: normalizedPhone,
        sender: senderId,
        sms,
        channel,
      })

      if (result.ok) return result
      lastFailure = result
    }
  }

  return lastFailure
}

export async function sendOtpSms(phoneNumber: string, otpCode: string): Promise<SmsSendResult> {
  const normalizedPhone = normalizeNigerianPhone(phoneNumber)
  if (!normalizedPhone) {
    return { ok: false, errorMessage: 'Invalid phone number.' }
  }

  const senderCandidates = getSenderCandidates('N-Alert')
  const channelCandidates = getChannelCandidates(String(process.env.TERMII_OTP_CHANNEL || 'generic'))
  const smsBody = `Your Make It Sell OTP is ${otpCode}`

  const otpTemplateName = String(process.env.WATI_OTP_TEMPLATE_NAME || '').trim()
  const whatsappOtpResult = await sendWhatsappIfConfigured({
    phoneNumber: normalizedPhone,
    message: smsBody,
    templateName: otpTemplateName,
    templateParams: [
      { name: 'code', value: otpCode },
      { name: 'otp', value: otpCode },
    ],
  })

  if (whatsappOtpResult?.ok) {
    return {
      ok: true,
      payload: {
        ...(whatsappOtpResult.payload || {}),
        channel: 'whatsapp',
      },
    }
  }

  let lastFailure: SmsSendResult = { ok: false, errorMessage: 'Failed to send OTP SMS.' }
  for (const senderId of senderCandidates) {
    for (const channel of channelCandidates) {
      const result = await sendTermiiSms({
        to: normalizedPhone,
        sender: senderId,
        channel,
        sms: smsBody,
      })

      if (result.ok) return result
      lastFailure = result
    }
  }

  const voiceFallbackEnabled = String(process.env.TERMII_VOICE_FALLBACK || 'true').trim().toLowerCase() !== 'false'
  if (voiceFallbackEnabled) {
    const voiceResult = await sendOtpVoiceFallback(normalizedPhone, otpCode)
    if (voiceResult.ok) {
      return {
        ok: true,
        payload: {
          ...(voiceResult.payload || {}),
          fallback: 'voice',
        },
      }
    }
    return voiceResult
  }

  return lastFailure
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

  const orderTemplateName = String(process.env.WATI_ORDER_TEMPLATE_NAME || '').trim()
  return await sendTransactionalSms({
    phoneNumber,
    sms,
    whatsappTemplateName: orderTemplateName,
    whatsappTemplateParams: [
      { name: 'order_id', value: shortOrderId },
      { name: 'amount', value: amountText },
    ],
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
}): Promise<SmsSendResult> {
  const dateText = new Date(bookingDate).toLocaleDateString('en-NG')
  const bookingRef = bookingId ? `#${String(bookingId).slice(0, 8).toUpperCase()}` : ''
  const timeText = endTime ? `${startTime}-${endTime}` : startTime
  const amountText = Number.isFinite(Number(totalPrice)) ? `, NGN ${Number(totalPrice || 0).toLocaleString('en-NG')}` : ''

  const sms = recipient === 'provider'
    ? `New booking ${bookingRef}: ${serviceTitle} on ${dateText} ${timeText}${amountText} for ${String(counterpartyName || 'customer')}.`
    : `Booking confirmed ${bookingRef}: ${serviceTitle} on ${dateText} ${timeText}${amountText}.`

  const bookingTemplateName = String(process.env.WATI_BOOKING_TEMPLATE_NAME || '').trim()
  return await sendTransactionalSms({
    phoneNumber,
    sms,
    whatsappTemplateName: bookingTemplateName,
    whatsappTemplateParams: [
      { name: 'service_title', value: serviceTitle },
      { name: 'date', value: dateText },
      { name: 'time', value: timeText },
    ],
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

  const customTemplateName = String(process.env.WATI_CUSTOM_TEMPLATE_NAME || '').trim()
  return await sendTransactionalSms({
    phoneNumber,
    sms: normalizedMessage,
    whatsappTemplateName: customTemplateName,
    whatsappTemplateParams: [{ name: 'message', value: normalizedMessage }],
  })
}
