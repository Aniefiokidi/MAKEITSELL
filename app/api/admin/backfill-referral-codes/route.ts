import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { requireCronOrAdminAccess } from '@/lib/server-route-auth'

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)]
  }
  return code
}

async function generateUniqueCode(existingCodes: Set<string>): Promise<string> {
  let attempts = 0
  while (attempts < 20) {
    const code = generateCode()
    if (!existingCodes.has(code)) {
      existingCodes.add(code)
      return code
    }
    attempts++
  }
  // Fallback: append timestamp suffix to guarantee uniqueness
  return generateCode() + Date.now().toString(36).toUpperCase().slice(-2)
}

async function runBackfill() {
  // Find ALL users missing a referralCode (vendors and buyers)
  const vendors = await User.find(
    { referralCode: { $exists: false } },
    { _id: 1 }
  ).lean() as any[]

  if (vendors.length === 0) {
    return { scanned: 0, updated: 0, alreadyHaveCode: 0 }
  }

  // Load all existing codes to avoid collisions
  const existingDocs = await User.find(
    { referralCode: { $exists: true } },
    { referralCode: 1 }
  ).lean() as any[]
  const existingCodes = new Set<string>(existingDocs.map((d: any) => String(d.referralCode)))

  let updated = 0

  for (const vendor of vendors) {
    const code = await generateUniqueCode(existingCodes)
    await User.updateOne(
      { _id: vendor._id, referralCode: { $exists: false } },
      { $set: { referralCode: code, updatedAt: new Date() } }
    )
    updated++
  }

  // Count how many users now have a code
  const alreadyHaveCode = await User.countDocuments({ referralCode: { $exists: true } })

  return {
    scanned: vendors.length,
    updated,
    totalVendorsWithCode: alreadyHaveCode,
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireCronOrAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    await connectToDatabase()
    const summary = await runBackfill()
    return NextResponse.json({ success: true, summary })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Backfill failed' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
