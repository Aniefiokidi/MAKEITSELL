export type SmsSendResult = {
  ok: boolean
  errorMessage?: string
  payload?: any
}

export function normalizeNigerianPhone(input: string): string | null {
  const raw = String(input || '').trim()
  if (!raw) return null

  const digits = raw.replace(/\D/g, '')

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
}: {
  to: string
  sms: string
  sender: string
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
        channel: 'generic',
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

  const primaryResult = await sendTermiiSms({
    to: phoneNumber,
    sender,
    sms: `Your Make It Sell OTP is ${otpCode}`,
  })

  if (primaryResult.ok) return primaryResult

  const senderNotConfigured = String(primaryResult.errorMessage || '').toLowerCase().includes('applicationsenderid not found')
  if (senderNotConfigured && fallbackSender && fallbackSender !== sender) {
    return await sendTermiiSms({
      to: phoneNumber,
      sender: fallbackSender,
      sms: `Your Make It Sell OTP is ${otpCode}`,
    })
  }

  return primaryResult
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
