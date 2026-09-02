// Site-wide "Coming Soon" gate. Presence of SITE_LOCK_PASSWORD activates the lock —
// unset (the default) and this is a total no-op, same pattern as EMAIL_TEST_MODE_RECIPIENT.
// Unlock cookie is SHA-256(current password), never the password itself, so rotating
// the password instantly invalidates every previously issued unlock cookie.
export const SITE_LOCK_COOKIE = 'mis_site_unlock'

export function isSiteLockEnabled(): boolean {
  return Boolean(process.env.SITE_LOCK_PASSWORD)
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function computeUnlockToken(password: string): Promise<string> {
  return sha256Hex(password)
}

export async function isValidUnlockCookie(cookieValue: string | undefined | null): Promise<boolean> {
  const password = process.env.SITE_LOCK_PASSWORD
  if (!password || !cookieValue) return false
  const expected = await computeUnlockToken(password)
  return cookieValue === expected
}
