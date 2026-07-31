// Cloudinary upload helper — uploads straight from the browser to Cloudinary using the
// unsigned preset, never touching our own server. This used to proxy through
// /api/uploads/cloudinary (which also ran sharp compression server-side), but Vercel
// caps Serverless Function request bodies at 4.5MB — a routine phone photo blows past
// that and gets rejected by Vercel's own infrastructure (413 FUNCTION_PAYLOAD_TOO_LARGE)
// before our code ever runs. That's why uploads worked locally (no such limit in
// `next dev`) but failed in production. Uploading direct sidesteps the limit entirely.
const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "ddhtduti2"
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "my_unsigned_preset"
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024 // 15MB — generous for a phone photo

export async function uploadToCloudinary(file: File): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`File is too large (max ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB)`)
  }

  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name)
  const resourceType = isPdf ? "raw" : "image"

  const formData = new FormData()
  formData.append("file", file)
  formData.append("upload_preset", UPLOAD_PRESET)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, {
    method: "POST",
    body: formData,
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data?.secure_url) {
    throw new Error(data?.error?.message || "Cloudinary upload failed")
  }

  return data.secure_url
}
