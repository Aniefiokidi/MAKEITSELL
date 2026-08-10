import crypto from 'crypto'
import mongoose from 'mongoose'
import connectToDatabase from '@/lib/mongodb'
import { AccountBlocklist } from '@/lib/models/AccountBlocklist'
import { normalizeNigerianPhone } from '@/lib/sms'

function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase()
}

function normalizePhone(phone: string): string | null {
  return phone ? normalizeNigerianPhone(phone) : null
}

// One-way SHA-256, as specified. Normalizing first (lowercase/trim email, canonical
// +234 phone format) matters as much as the hash itself — hashing two different-cased
// or differently-formatted spellings of the same identity would silently produce two
// different hashes and defeat the whole check.
export function hashIdentifier(normalizedValue: string): string {
  return crypto.createHash('sha256').update(normalizedValue).digest('hex')
}

function buildHashOrClauses(input: { email?: string | null; phone?: string | null }) {
  const clauses: Array<Record<string, string>> = []
  const normalizedEmail = input.email ? normalizeEmail(input.email) : ''
  const normalizedPhone = input.phone ? normalizePhone(input.phone) : null
  if (normalizedEmail) clauses.push({ emailHash: hashIdentifier(normalizedEmail) })
  if (normalizedPhone) clauses.push({ phoneHash: hashIdentifier(normalizedPhone) })
  return clauses
}

// Checked at every account-creation entry point — currently /api/auth/signup and the
// WhatsApp buyer auto-create path (lib/whatsapp/buyer-identity.ts), which creates a User
// record with no signup form involved at all. Both must check this, or a blocklisted
// phone number could bypass the block simply by messaging the WhatsApp bot instead of
// using the web form.
export async function isBlocklisted(input: { email?: string | null; phone?: string | null }): Promise<boolean> {
  const clauses = buildHashOrClauses(input)
  if (clauses.length === 0) return false

  await connectToDatabase()
  const match = await AccountBlocklist.findOne({ $or: clauses }).select('_id').lean()
  return Boolean(match)
}

// Only ever called from the account-deletion flow, and only when the account being
// deleted is fraud-flagged (see User.fraudBanned) — never for a normal, voluntary
// deletion. Stores hashes only; the caller is responsible for passing the ORIGINAL
// email/phone before those fields are erased on the user document.
export async function addToBlocklist(input: {
  email?: string | null
  phone?: string | null
  reason: string
  originalUserId?: string
  session?: mongoose.ClientSession
}): Promise<void> {
  const normalizedEmail = input.email ? normalizeEmail(input.email) : ''
  const normalizedPhone = input.phone ? normalizePhone(input.phone) : null
  if (!normalizedEmail && !normalizedPhone) return

  await connectToDatabase()
  await AccountBlocklist.create(
    [
      {
        emailHash: normalizedEmail ? hashIdentifier(normalizedEmail) : undefined,
        phoneHash: normalizedPhone ? hashIdentifier(normalizedPhone) : undefined,
        reason: input.reason,
        originalUserId: input.originalUserId,
      },
    ],
    { session: input.session }
  )
}
