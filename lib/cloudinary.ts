// Cloudinary upload helper
export async function uploadToCloudinary(file: File): Promise<string> {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const url = `https://api.cloudinary.com/v1_1/ddhtduti2/${isPdf ? "raw" : "image"}/upload`;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "my_unsigned_preset");

  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) throw new Error("Cloudinary upload failed");
  const data = await response.json();
  return data.secure_url;
}
