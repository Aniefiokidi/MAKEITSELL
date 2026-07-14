import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import sharp from 'sharp'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'

function getEnv(name: string): string {
  return String(process.env[name] || '').trim()
}

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024 // 15MB — generous for a phone photo, cheap to reject before processing
const MAX_DIMENSION = 1920 // covers even a full-bleed hero banner; delivery-time transforms downsize further per placement

// Resize/compress before it ever reaches Cloudinary, so what gets stored is already
// small — this works regardless of signed vs unsigned upload mode (the unsigned preset
// used here won't honor an arbitrary incoming `transformation` param). PNGs/images with
// transparency go to WebP (keeps alpha); everything else goes to JPEG.
async function compressImage(file: File): Promise<{ buffer: Buffer; mime: string; ext: string }> {
  const inputBuffer = Buffer.from(await file.arrayBuffer())
  const image = sharp(inputBuffer).rotate() // auto-orient from EXIF, then strip it
  const metadata = await image.metadata()
  const resized = image.resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })

  if (metadata.hasAlpha) {
    const buffer = await resized.webp({ quality: 82 }).toBuffer()
    return { buffer, mime: 'image/webp', ext: 'webp' }
  }

  const buffer = await resized.jpeg({ quality: 82, mozjpeg: true }).toBuffer()
  return { buffer, mime: 'image/jpeg', ext: 'jpg' }
}

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const form = await request.formData()
    const file = form.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { success: false, error: `File is too large (max ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB)` },
        { status: 400 }
      )
    }

    const cloudName = getEnv('CLOUDINARY_CLOUD_NAME') || 'ddhtduti2'
    const apiKey = getEnv('CLOUDINARY_API_KEY')
    const apiSecret = getEnv('CLOUDINARY_API_SECRET')
    const unsignedPreset = getEnv('CLOUDINARY_UPLOAD_PRESET') || getEnv('NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET') || 'my_unsigned_preset'

    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
    const resourceType = isPdf ? 'raw' : 'image'

    const uploadForm = new FormData()

    if (isPdf) {
      // PDFs pass through untouched — compression only applies to images.
      uploadForm.append('file', file)
    } else {
      try {
        const { buffer, mime, ext } = await compressImage(file)
        uploadForm.append('file', new Blob([new Uint8Array(buffer)], { type: mime }), `upload.${ext}`)
      } catch (compressError) {
        console.error('[uploads/cloudinary] Compression failed, uploading original:', compressError)
        uploadForm.append('file', file)
      }
    }

    if (apiKey && apiSecret) {
      const timestamp = Math.floor(Date.now() / 1000)
      const signaturePayload = `timestamp=${timestamp}${apiSecret}`
      const signature = crypto.createHash('sha1').update(signaturePayload).digest('hex')

      uploadForm.append('api_key', apiKey)
      uploadForm.append('timestamp', String(timestamp))
      uploadForm.append('signature', signature)
    } else {
      uploadForm.append('upload_preset', unsignedPreset)
    }

    const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`
    const response = await fetch(endpoint, {
      method: 'POST',
      body: uploadForm,
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok || !payload?.secure_url) {
      const cloudError = String(payload?.error?.message || payload?.message || `HTTP ${response.status}`)
      return NextResponse.json(
        {
          success: false,
          error: `Cloudinary upload failed: ${cloudError}`,
          details: payload,
        },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true, secure_url: payload.secure_url })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Cloudinary upload failed',
      },
      { status: 500 }
    )
  }
}
