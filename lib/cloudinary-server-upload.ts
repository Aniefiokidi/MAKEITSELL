// Server-side (buffer-to-Cloudinary) upload — every existing upload path in this app is
// browser-only (lib/cloudinary.ts uploads straight from the browser to sidestep Vercel's
// 4.5MB request-body cap; app/api/uploads/cloudinary/route.ts is legacy, requires a web
// session + FormData, and — checked against this deployment's actual env vars — its
// signed-upload branch is dead code here anyway: CLOUDINARY_API_KEY/SECRET were never
// configured, only the public unsigned-preset vars lib/cloudinary.ts uses. So this uses
// that same unsigned preset, not a signed upload, to actually work against how this app's
// Cloudinary account is really set up. Callable from server code holding a raw Buffer,
// which is what the WhatsApp bot has after downloading a buyer's photo
// (lib/whatsapp/media.ts's downloadWhatsAppMedia) — there's no browser in this path, so
// Vercel's request-body limit doesn't apply (outbound call to Cloudinary, not inbound).
function getEnv(name: string): string {
  return String(process.env[name] || '').trim()
}

export async function uploadBufferToCloudinary(buffer: Buffer, mimeType: string): Promise<string | null> {
  const cloudName = getEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME') || getEnv('CLOUDINARY_CLOUD_NAME') || 'ddhtduti2'
  const uploadPreset = getEnv('NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET') || getEnv('CLOUDINARY_UPLOAD_PRESET') || 'my_unsigned_preset'

  try {
    const form = new FormData()
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
    form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType || 'image/jpeg' }), `upload.${ext}`)
    form.append('upload_preset', uploadPreset)

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: form,
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok || !payload?.secure_url) {
      console.error('[cloudinary-server-upload] Upload failed:', payload?.error?.message || `HTTP ${response.status}`)
      return null
    }

    return String(payload.secure_url)
  } catch (error) {
    console.error('[cloudinary-server-upload] Upload error:', error)
    return null
  }
}
