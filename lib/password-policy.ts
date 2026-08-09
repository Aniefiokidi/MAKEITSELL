// Server-side password policy — the ONLY place this is actually enforced. Every client-
// side length check in the app (SignupForm.tsx, forgot-password/page.tsx, etc.) is UX-only
// and was previously unbacked by any server check, so calling the API directly bypassed it
// entirely. Follows NIST SP 800-63B guidance: prioritize length + breach-checking over
// arbitrary composition rules (mandatory uppercase/symbol requirements measurably push
// users toward predictable patterns like "Password1!" rather than actually stronger ones).
import crypto from 'crypto'

const MIN_PASSWORD_LENGTH = 8

export function validatePasswordLength(password: unknown): { valid: boolean; error?: string } {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }
  }
  return { valid: true }
}

// Checks the password against Have I Been Pwned's breached-password range API using its
// k-anonymity model: only the first 5 hex chars of the SHA-1 hash are ever sent over the
// network, never the password or the full hash, so HIBP (or anyone observing the request)
// can't recover the password from it. Fails OPEN (treats as "not pwned") on any network or
// API error — this is a defense-in-depth check layered on top of the length requirement,
// not the primary gate, and a third-party outage must never block signup/reset.
export async function checkPasswordPwned(password: string): Promise<{ pwned: boolean; count: number }> {
  try {
    const sha1 = crypto.createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase()
    const prefix = sha1.slice(0, 5)
    const suffix = sha1.slice(5)

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
    })
    if (!response.ok) return { pwned: false, count: 0 }

    const text = await response.text()
    const line = text.split('\n').find((entry) => entry.trim().toUpperCase().startsWith(suffix))
    if (!line) return { pwned: false, count: 0 }

    const count = Number(line.split(':')[1]?.trim() || 0)
    return { pwned: count > 0, count }
  } catch (error) {
    console.error('[password-policy] HIBP check failed, failing open:', error)
    return { pwned: false, count: 0 }
  }
}

// Combined check used by every code path that sets a password (signup, reset, temp-
// password completion, admin reset). Length is checked first since it's free — no point
// hashing and calling out to HIBP for a password that already fails the basic bar.
export async function validatePassword(password: unknown): Promise<{ valid: boolean; error?: string }> {
  const lengthCheck = validatePasswordLength(password)
  if (!lengthCheck.valid) return lengthCheck

  const { pwned, count } = await checkPasswordPwned(password as string)
  if (pwned) {
    return {
      valid: false,
      error: `This password has appeared in ${count.toLocaleString()} known data breaches. Please choose a different password.`,
    }
  }

  return { valid: true }
}
