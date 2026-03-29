import crypto from 'crypto'

const SCRYPT_PREFIX = 'scrypt'
const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEY_LENGTH = 64

const safeEqual = (a: string, b: string) => {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return crypto.timingSafeEqual(aBuf, bBuf)
}

const hashSha256 = (password: string) => crypto.createHash('sha256').update(password).digest('hex')

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = crypto.scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  })

  return [
    SCRYPT_PREFIX,
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt,
    derivedKey.toString('hex'),
  ].join('$')
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false

  if (storedHash.startsWith(`${SCRYPT_PREFIX}$`)) {
    const [prefix, nRaw, rRaw, pRaw, salt, hashHex] = storedHash.split('$')
    if (prefix !== SCRYPT_PREFIX || !nRaw || !rRaw || !pRaw || !salt || !hashHex) {
      return false
    }

    const N = Number(nRaw)
    const r = Number(rRaw)
    const p = Number(pRaw)

    if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) {
      return false
    }

    const derivedKey = crypto.scryptSync(password, salt, KEY_LENGTH, { N, r, p }).toString('hex')
    return safeEqual(derivedKey, hashHex)
  }

  // Legacy support for existing SHA-256 password hashes.
  const legacyHash = hashSha256(password)
  return safeEqual(legacyHash, storedHash)
}

export function needsPasswordRehash(storedHash: string): boolean {
  return !storedHash.startsWith(`${SCRYPT_PREFIX}$`)
}
