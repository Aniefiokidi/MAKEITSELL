const DEFAULT_APP_URL = 'https://www.makeitsell.ng'

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '')

const isLocalHost = (hostname: string) => {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

export const canonicalizeAppUrl = (input?: string | null): string => {
  const raw = String(input || '').trim()
  const candidate = raw || DEFAULT_APP_URL

  try {
    const url = new URL(candidate)
    const hostname = url.hostname.toLowerCase()
    const legacyBaseHost = `makeitsell.${'org'}`
    const canonicalBaseHost = 'makeitsell.ng'
    const canonicalWwwHost = `www.${canonicalBaseHost}`

    if (!isLocalHost(hostname)) {
      if (
        hostname === legacyBaseHost
        || hostname === `www.${legacyBaseHost}`
        || hostname === canonicalBaseHost
        || hostname === canonicalWwwHost
      ) {
        url.hostname = canonicalWwwHost
      } else if (hostname.endsWith(`.${legacyBaseHost}`)) {
        url.hostname = `${hostname.slice(0, -legacyBaseHost.length)}${canonicalBaseHost}`
      } else if (hostname.endsWith(`.${canonicalBaseHost}`)) {
        url.hostname = `${hostname.slice(0, -canonicalBaseHost.length)}${canonicalBaseHost}`
      }
    }

    return stripTrailingSlash(url.origin)
  } catch {
    return DEFAULT_APP_URL
  }
}

export const getCanonicalAppBaseUrl = (requestOrigin?: string | null): string => {
  const envCandidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.SITE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  ]

  const primary = String(requestOrigin || '').trim()
  if (primary) {
    return canonicalizeAppUrl(primary)
  }

  for (const candidate of envCandidates) {
    if (String(candidate || '').trim()) {
      return canonicalizeAppUrl(candidate)
    }
  }

  return canonicalizeAppUrl(DEFAULT_APP_URL)
}
