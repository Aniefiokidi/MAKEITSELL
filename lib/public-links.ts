const SLUG_SEPARATOR = "--"

const slugify = (value: string): string => {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export const extractEntityIdFromParam = (param: string | string[] | undefined): string => {
  if (!param) return ""
  const raw = Array.isArray(param) ? param[0] : param
  const decoded = decodeURIComponent(String(raw || "")).trim().replace(/\/+$/g, "")
  if (!decoded) return ""

  const markerIndex = decoded.lastIndexOf(SLUG_SEPARATOR)
  if (markerIndex >= 0) {
    return decoded.slice(markerIndex + SLUG_SEPARATOR.length)
  }

  return decoded
}

export const buildPublicStorePath = (store: any): string => {
  const storedSlug = String(store?.publicSlug || "").trim()
  const name = String(store?.storeName || store?.name || "store")
  const slug = storedSlug || slugify(name) || "store"
  return `/store/${slug}`
}

export const buildPublicServicePath = (service: any): string => {
  const storedSlug = String(service?.publicSlug || "").trim()
  const name = String(service?.title || service?.name || service?.serviceTitle || "service")
  const slug = storedSlug || slugify(name) || "service"
  return `/service/${slug}`
}
