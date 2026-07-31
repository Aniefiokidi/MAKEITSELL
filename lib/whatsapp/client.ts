// WhatsApp Cloud API client — thin wrapper for sending messages via Meta's Graph API.
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages

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

// Sends an approved WhatsApp message template by name with an ordered list of body
// text-variable values. These deliver even outside Meta's 24h customer-service window,
// unlike sendTextMessage — that's the whole reason to use one. A static Quick Reply
// button (as opposed to a dynamic-URL button) needs no components entry of its own: it's
// baked into the approved template and Meta renders it automatically whenever the
// template is sent, so `components` here only ever carries the body parameters.
export async function sendTemplateMessage(
  to: string,
  templateName: string,
  bodyParams: string[],
  languageCode: string = 'en'
): Promise<any> {
  const { accessToken, phoneNumberId } = getConfig()
  if (!accessToken || !phoneNumberId) {
    throw new Error('WhatsApp is not configured — set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID')
  }

  const components = bodyParams.length > 0
    ? [{ type: 'body', parameters: bodyParams.map((text) => ({ type: 'text', text })) }]
    : []

  const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    console.error('[whatsapp-client] sendTemplateMessage failed:', JSON.stringify(data))
    throw new Error(data?.error?.message || `WhatsApp API request failed with status ${response.status}`)
  }

  return data
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

// Sends a product photo with a caption — used by the buyer-browsing flow to present
// search/category results. `imageUrl` must be a publicly fetchable link (WhatsApp fetches
// it server-side); the caller is responsible for keeping it under WhatsApp's 5MB media
// limit (see buildWhatsAppImageUrl's Cloudinary transform in lib/whatsapp/buyer.ts).
export async function sendImageMessage(to: string, imageUrl: string, caption: string): Promise<any> {
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
      type: 'image',
      image: { link: imageUrl, caption },
    }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    console.error('[whatsapp-client] sendImageMessage failed:', JSON.stringify(data))
    throw new Error(data?.error?.message || `WhatsApp API request failed with status ${response.status}`)
  }

  return data
}

export interface WhatsAppListRow {
  id: string
  title: string
  description?: string
}

// Sends an interactive list message (e.g. the category menu). Meta hard-caps this at 10
// rows total across ALL sections combined, row title <=24 chars, row description <=72
// chars, section title <=24 chars, button text <=20 chars, body <=1024 chars — callers
// must stay within these or the send will be rejected by the Graph API.
export async function sendInteractiveListMessage(
  to: string,
  bodyText: string,
  buttonText: string,
  rows: WhatsAppListRow[]
): Promise<any> {
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
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: bodyText },
        action: {
          button: buttonText,
          sections: [{ rows }],
        },
      },
    }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    console.error('[whatsapp-client] sendInteractiveListMessage failed:', JSON.stringify(data))
    throw new Error(data?.error?.message || `WhatsApp API request failed with status ${response.status}`)
  }

  return data
}
