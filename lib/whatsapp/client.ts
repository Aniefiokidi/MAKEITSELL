// WhatsApp Cloud API client — thin wrapper for sending messages via Meta's Graph API.
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
// Foundation only — just sendTextMessage for now, no template/media senders yet.

const GRAPH_API_VERSION = 'v23.0'

function getConfig() {
  return {
    accessToken: String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim(),
    phoneNumberId: String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim(),
  }
}

let cachedDisplayPhoneNumber: { value: string; fetchedAt: number } | null = null
const DISPLAY_NUMBER_CACHE_MS = 60 * 60 * 1000 // 1h — this rarely changes

// The bot's own display number (e.g. "+1 555 618 7305" for a Meta test number) — shown
// to vendors as "message this code to <number>" on the Connect WhatsApp card. Fetched
// live rather than hardcoded since WHATSAPP_PHONE_NUMBER_ID gets swapped (test → prod)
// without necessarily updating a second hardcoded constant in sync.
export async function getBotDisplayPhoneNumber(): Promise<string | null> {
  if (cachedDisplayPhoneNumber && Date.now() - cachedDisplayPhoneNumber.fetchedAt < DISPLAY_NUMBER_CACHE_MS) {
    return cachedDisplayPhoneNumber.value
  }

  const { accessToken, phoneNumberId } = getConfig()
  if (!accessToken || !phoneNumberId) return null

  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}?fields=display_phone_number`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data?.display_phone_number) {
      console.error('[whatsapp-client] getBotDisplayPhoneNumber failed:', JSON.stringify(data))
      return null
    }
    cachedDisplayPhoneNumber = { value: data.display_phone_number, fetchedAt: Date.now() }
    return data.display_phone_number
  } catch (error) {
    console.error('[whatsapp-client] getBotDisplayPhoneNumber request failed:', error)
    return null
  }
}

export async function sendTextMessage(to: string, body: string): Promise<any> {
  const { accessToken, phoneNumberId } = getConfig()
  if (!accessToken || !phoneNumberId) {
    throw new Error('WhatsApp is not configured — set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID')
  }

  const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    console.error('[whatsapp-client] sendTextMessage failed:', JSON.stringify(data))
    throw new Error(data?.error?.message || `WhatsApp API request failed with status ${response.status}`)
  }

  return data
}
