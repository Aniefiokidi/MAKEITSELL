// Cloudinary upload helper
export async function uploadToCloudinary(file: File): Promise<string> {
  const formData = new FormData()
  formData.append("file", file)

  const response = await fetch("/api/uploads/cloudinary", {
    method: "POST",
    body: formData,
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data?.secure_url) {
    throw new Error(data?.error || "Cloudinary upload failed")
  }

  return data.secure_url
}
