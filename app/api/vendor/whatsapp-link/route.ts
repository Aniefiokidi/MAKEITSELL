import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import connectToDatabase from '@/lib/mongodb'
import { WhatsAppLink } from '@/lib/models/WhatsAppLink'
import { requireRoles } from '@/lib/server-route-auth'
import { getBotDisplayPhoneNumber } from '@/lib/whatsapp/client'

const CODE_LENGTH = 6
const CODE_TTL_MS = 10 * 60 * 1000
// Unambiguous charset — no 0/O or 1/I/L, since vendors type this on a phone keyboard.
const CODE_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function generateCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARSET[crypto.randomInt(CODE_CHARSET.length)]
  }
  return code
}

// Current link status for the logged-in vendor — dashboard uses this to show either the
// "connected" state or a "generate a code" prompt.
export async function GET(request: NextRequest) {
  const { user, response } = await requireRoles(request, ['vendor'])
  if (response) return response

  await connectToDatabase()
  const link: any = await WhatsAppLink.findOne({ vendorId: user!.id }).lean()

  if (!link) {
    return NextResponse.json({ success: true, status: 'unlinked' })
  }

  const codeStillValid = link.status === 'pending' && link.code && new Date(link.codeExpiresAt) > new Date()

  return NextResponse.json({
    success: true,
    status: link.status,
    linkedAt: link.linkedAt || null,
    pendingCode: codeStillValid ? link.code : null,
    codeExpiresAt: codeStillValid ? link.codeExpiresAt : null,
  })
}

// Generates a fresh one-time code for the logged-in vendor to send to the bot number.
// Overwrites any previous pending code — a vendor generating a new code supersedes the
// old one. Does NOT touch an existing linked waId; that's only replaced once the new
// code is actually confirmed via WhatsApp (see lib/whatsapp/commands.ts), so a vendor
// generating a code by mistake doesn't break their existing working link.
export async function POST(request: NextRequest) {
  const { user, response } = await requireRoles(request, ['vendor'])
  if (response) return response

  await connectToDatabase()

  const code = generateCode()
  const codeExpiresAt = new Date(Date.now() + CODE_TTL_MS)

  await WhatsAppLink.updateOne(
    { vendorId: user!.id },
    {
      $set: { code, codeExpiresAt, status: 'pending', updatedAt: new Date() },
      $setOnInsert: { vendorId: user!.id, waId: null, linkedAt: null, createdAt: new Date() },
    },
    { upsert: true }
  )

  const botNumber = await getBotDisplayPhoneNumber()

  return NextResponse.json({
    success: true,
    code,
    codeExpiresAt,
    botNumber,
  })
}
