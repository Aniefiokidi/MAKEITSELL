export type WatiResult = {
  ok: boolean
  errorMessage?: string
  payload?: any
}

function normalizeWhatsappNumber(input: string): string | null {
  const raw = String(input || '').trim()
  if (!raw) return null

  const digits = raw.replace(/\D/g, '')

  if (digits.length === 10 && /^[7-9]\d{9}$/.test(digits)) {
    return `234${digits}`
  }

  if (digits.startsWith('0') && digits.length === 11) {
    return `234${digits.slice(1)}`
  }

  if (digits.startsWith('234') && digits.length === 13) {
    return digits
  }

  if (digits.length >= 8 && digits.length <= 15) {
    return digits
  }

  return null
}

function getWatiConfig() {
  const baseUrl = String(process.env.WATI_BASE_URL || '').trim().replace(/\/$/, '')
  const bearerToken = String(process.env.WATI_BEARER_TOKEN || process.env.WATI_API_TOKEN || '').trim().replace(/^Bearer\s+/i, '')

  return {
    baseUrl,
    bearerToken,
    enabled: String(process.env.WATI_ENABLED || 'false').trim().toLowerCase() === 'true',
  }
}

export async function sendWatiSessionMessage({
  phoneNumber,
  message,
}: {
  phoneNumber: string
  message: string
}): Promise<WatiResult> {
  try {
    const { baseUrl, bearerToken, enabled } = getWatiConfig()
    if (!enabled) {
      return { ok: false, errorMessage: 'WATI is disabled.' }
    }

    if (!baseUrl || !bearerToken) {
      return { ok: false, errorMessage: 'WATI_BASE_URL or WATI_BEARER_TOKEN is not configured.' }
    }

    const whatsappNumber = normalizeWhatsappNumber(phoneNumber)
    if (!whatsappNumber) {
      return { ok: false, errorMessage: 'Invalid WhatsApp phone number.' }
    }

    const response = await fetch(`${baseUrl}/api/v1/sendSessionMessage/${whatsappNumber}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `messageText=${encodeURIComponent(String(message || '').trim())}`,
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok || payload?.result !== true) {
      return {
        ok: false,
        payload,
        errorMessage: String(payload?.info || payload?.message || `HTTP ${response.status}`),
      }
    }

    return { ok: true, payload }
  } catch (error: any) {
    return { ok: false, errorMessage: error?.message || 'WATI session message request failed.' }
  }
}

export async function sendWatiTemplateMessage({
  phoneNumber,
  templateName,
  parameters,
  broadcastName,
}: {
  phoneNumber: string
  templateName: string
  parameters: Array<{ name: string; value: string }>
  broadcastName?: string
}): Promise<WatiResult> {
  try {
    const { baseUrl, bearerToken, enabled } = getWatiConfig()
    if (!enabled) {
      return { ok: false, errorMessage: 'WATI is disabled.' }
    }

    if (!baseUrl || !bearerToken) {
      return { ok: false, errorMessage: 'WATI_BASE_URL or WATI_BEARER_TOKEN is not configured.' }
    }

    const whatsappNumber = normalizeWhatsappNumber(phoneNumber)
    if (!whatsappNumber) {
      return { ok: false, errorMessage: 'Invalid WhatsApp phone number.' }
    }

    if (!String(templateName || '').trim()) {
      return { ok: false, errorMessage: 'templateName is required for WATI template message.' }
    }

    const response = await fetch(`${baseUrl}/api/v1/sendTemplateMessage?whatsappNumber=${encodeURIComponent(whatsappNumber)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template_name: String(templateName).trim(),
        broadcast_name: String(broadcastName || `makeitsell_${Date.now()}`).trim(),
        parameters: (parameters || []).map((param) => ({
          name: String(param?.name || '').trim(),
          value: String(param?.value || ''),
        })),
      }),
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok || payload?.result !== true) {
      return {
        ok: false,
        payload,
        errorMessage: String(payload?.info || payload?.message || `HTTP ${response.status}`),
      }
    }

    return { ok: true, payload }
  } catch (error: any) {
    return { ok: false, errorMessage: error?.message || 'WATI template message request failed.' }
  }
}
