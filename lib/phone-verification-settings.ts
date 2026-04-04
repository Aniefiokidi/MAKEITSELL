import { AdminSetting } from '@/lib/models/AdminSetting'

export const PHONE_VERIFICATION_SETTINGS_KEY = 'phone-verification-settings'
const DEFAULT_TEST_EMAIL = 'arnoldeee123@gmail.com'

export type PhoneVerificationSettings = {
  enabled: boolean
  allowedEmails: string[]
}

export function getPhoneVerificationTestEmail(): string {
  return String(process.env.PHONE_VERIFICATION_TEST_EMAIL || DEFAULT_TEST_EMAIL)
    .trim()
    .toLowerCase()
}

function normalizeEmail(input: unknown): string {
  return String(input || '').trim().toLowerCase()
}

export function sanitizePhoneVerificationSettings(input: any): PhoneVerificationSettings {
  const enabled = input?.enabled === undefined ? true : !!input?.enabled
  const rawEmails: unknown[] = Array.isArray(input?.allowedEmails) ? input.allowedEmails : []
  const normalizedEmails = rawEmails
    .map((email: unknown) => normalizeEmail(email))
    .filter((email): email is string => !!email)
  const allowedEmails: string[] = Array.from(new Set(normalizedEmails))

  return { enabled, allowedEmails }
}

export async function getPhoneVerificationSettings(): Promise<PhoneVerificationSettings> {
  const existing = await AdminSetting.findOne({ key: PHONE_VERIFICATION_SETTINGS_KEY }).lean()
  return sanitizePhoneVerificationSettings(existing?.value)
}

export async function isPhoneVerificationEnabledForEmail(email: string): Promise<boolean> {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return false

  const testEmail = getPhoneVerificationTestEmail()
  if (normalizedEmail === testEmail) {
    return true
  }

  const settings = await getPhoneVerificationSettings()
  if (!settings.enabled) return false
  // Global rollout: when enabled, all authenticated users can verify phone.
  return true
}
