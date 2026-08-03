// Downloads inbound WhatsApp media (photos sent by buyers) via Meta's 2-step media flow:
// 1) GET /{media-id} -> a short-lived (5 min) signed URL + mime_type
// 2) GET that URL (same bearer token) -> raw bytes
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media
const GRAPH_API_VERSION = 'v23.0'

function getAccessToken(): string {
  return String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim()
}

export interface DownloadedMedia {
  buffer: Buffer
  mimeType: string
}

export async function downloadWhatsAppMedia(mediaId: string): Promise<DownloadedMedia | null> {
  const accessToken = getAccessToken()
  if (!accessToken || !mediaId) return null

  try {
    const metaResponse = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const meta = await metaResponse.json().catch(() => ({}))
    if (!metaResponse.ok || !meta?.url) {
      console.error('[whatsapp-media] Failed to resolve media URL:', JSON.stringify(meta))
      return null
    }

    const fileResponse = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!fileResponse.ok) {
      console.error(`[whatsapp-media] Failed to download media bytes: ${fileResponse.status}`)
      return null
    }

    const buffer = Buffer.from(await fileResponse.arrayBuffer())
    const mimeType = String(meta.mime_type || fileResponse.headers.get('content-type') || '').trim()
    return { buffer, mimeType }
  } catch (error) {
    console.error('[whatsapp-media] downloadWhatsAppMedia failed:', error)
    return null
  }
}
