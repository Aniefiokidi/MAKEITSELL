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

async function sendTermiiSms({
  to,
  sms,
  sender,
  channel = 'generic',
}: {
  to: string
  sms: string
  sender: string
  channel?: string
}): Promise<SmsSendResult> {
  try {
    const apiKey = String(process.env.TERMII_API_KEY || '').trim()
    const baseUrl = String(process.env.TERMII_BASE_URL || 'https://api.ng.termii.com').replace(/\/$/, '')

    if (!apiKey) {
      return { ok: false, errorMessage: 'TERMII_API_KEY is not configured on the server.' }
    }

    const response = await fetch(`${baseUrl}/api/sms/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
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
}: {
  phoneNumber: string
  orderId: string
  amount: number
}): Promise<SmsSendResult> {
  const sender = String(process.env.TERMII_SENDER || 'MakeItSell').trim()
  return await sendTermiiSms({
    to: phoneNumber,
    sender,
    sms: `Order confirmed: ${String(orderId).slice(0, 8).toUpperCase()} amount NGN ${Number(amount || 0).toLocaleString('en-NG')}.`,
  })
}

export async function sendBookingConfirmationSms({
  phoneNumber,
  serviceTitle,
  bookingDate,
  startTime,
}: {
  phoneNumber: string
  serviceTitle: string
  bookingDate: Date
  startTime: string
}): Promise<SmsSendResult> {
  const sender = String(process.env.TERMII_SENDER || 'MakeItSell').trim()
  const dateText = new Date(bookingDate).toLocaleDateString('en-NG')
  return await sendTermiiSms({
    to: phoneNumber,
    sender,
    sms: `Booking confirmed for ${serviceTitle} on ${dateText} at ${startTime}.`,
  })
}

export async function sendCustomSms({
  phoneNumber,
  message,
}: {
  phoneNumber: string
  message: string
}): Promise<SmsSendResult> {
  const sender = String(process.env.TERMII_SENDER || 'MakeItSell').trim()
  return await sendTermiiSms({
    to: phoneNumber,
    sender,
    sms: String(message || '').trim(),
  })
}
