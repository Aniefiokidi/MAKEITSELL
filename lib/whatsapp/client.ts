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
