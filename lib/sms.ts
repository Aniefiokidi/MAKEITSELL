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

async function sendTermiiSms({
  to,
  sms,
  sender,
  channel = 'dnd',
}: {
  to: string
  sms: string
  sender: string
  channel?: string
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

async function sendTransactionalSms({
  phoneNumber,
  sms,
  sender,
}: {
  phoneNumber: string
  sms: string
  sender?: string
}): Promise<SmsSendResult> {
  const primarySender = String(sender || process.env.TERMII_SENDER || 'MakeItSell').trim()
  const fallbackSender = String(process.env.TERMII_SENDER_FALLBACK || 'N-Alert').trim()
  const preferredChannel = String(process.env.TERMII_TRANSACTIONAL_CHANNEL || 'dnd').trim().toLowerCase()

  const senderCandidates = Array.from(new Set([primarySender, fallbackSender].filter(Boolean)))
  const channelCandidates = Array.from(
    new Set(
      [preferredChannel || 'dnd', 'dnd', 'generic'].filter(
        (value) => value === 'dnd' || value === 'generic'
      )
    )
  )

  let lastFailure: SmsSendResult = { ok: false, errorMessage: 'Failed to send transactional SMS.' }
  const normalizedTo = toTermiiFormat(phoneNumber)

  for (const senderId of senderCandidates) {
    for (const channel of channelCandidates) {
      const result = await sendTermiiSms({
        to: normalizedTo,
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
  const sender = String(process.env.TERMII_SENDER || 'MakeItSell').trim()
  const fallbackSender = String(process.env.TERMII_SENDER_FALLBACK || 'N-Alert').trim()
  const normalizedPhone = String(phoneNumber || '').trim()
  const preferredOtpChannel = String(process.env.TERMII_OTP_CHANNEL || 'dnd').trim().toLowerCase()

  const recipientCandidates = Array.from(
    new Set(
      [
        normalizedPhone,
        normalizedPhone.startsWith('+') ? normalizedPhone.slice(1) : normalizedPhone,
      ].filter(Boolean)
    )
  )

  const senderCandidates = Array.from(
    new Set([sender, fallbackSender].filter(Boolean))
  )

  const channelCandidates = Array.from(
    new Set(
      [
        preferredOtpChannel || 'dnd',
        'dnd',
        'generic',
      ].filter((value) => value === 'dnd' || value === 'generic')
    )
  )

  let lastFailure: SmsSendResult = { ok: false, errorMessage: 'Failed to send OTP SMS.' }

  for (const to of recipientCandidates) {
    for (const senderId of senderCandidates) {
      for (const channel of channelCandidates) {
        const result = await sendTermiiSms({
          to,
          sender: senderId,
          channel,
          sms: `Your Make It Sell OTP is ${otpCode}`,
        })

        if (result.ok) return result
        lastFailure = result
      }
    }
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
  const itemAmount = Number.isFinite(Number(productSubtotal))
    ? Number(productSubtotal)
    : totalAmount
  const deliveryAmount = Number.isFinite(Number(deliveryFee))
    ? Number(deliveryFee)
    : Math.max(0, totalAmount - itemAmount)

  const amountText = `NGN ${totalAmount.toLocaleString('en-NG')}`
  const productPriceText = `NGN ${itemAmount.toLocaleString('en-NG')}`
  const deliveryPriceText = deliveryAmount > 0 ? `NGN ${deliveryAmount.toLocaleString('en-NG')}` : 'FREE'
  const qtyText = Number.isFinite(Number(itemCount)) && Number(itemCount) > 0
    ? `${Number(itemCount)} item(s), `
    : ''

  const sms = recipient === 'vendor'
    ? `New order ${shortOrderId}: ${qtyText}Total ${amountText}, Product ${productPriceText}, Delivery ${deliveryPriceText} from ${String(counterpartyName || 'customer').trim()}. Check dashboard.`
    : `Order confirmed ${shortOrderId}: ${qtyText}Total ${amountText}, Product ${productPriceText}, Delivery ${deliveryPriceText}${deliveryCity ? `, delivery to ${deliveryCity}` : ''}.`

  return await sendTransactionalSms({
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

  return await sendTransactionalSms({
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
  return await sendTransactionalSms({
    phoneNumber,
    sms: String(message || '').trim(),
  })
}
