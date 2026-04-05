import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'

function getEnv(name: string): string {
  return String(process.env[name] || '').trim()
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

    const cloudName = getEnv('CLOUDINARY_CLOUD_NAME') || 'ddhtduti2'
    const apiKey = getEnv('CLOUDINARY_API_KEY')
    const apiSecret = getEnv('CLOUDINARY_API_SECRET')
    const unsignedPreset = getEnv('CLOUDINARY_UPLOAD_PRESET') || getEnv('NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET') || 'my_unsigned_preset'

    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
    const resourceType = isPdf ? 'raw' : 'image'

    const uploadForm = new FormData()
    uploadForm.append('file', file)

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
