import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import connectToDatabase from "@/lib/mongodb"
import { User } from "@/lib/models/User"

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex")
  const derivedKey = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })
  return ["scrypt", 16384, 8, 1, salt, derivedKey.toString("hex")].join("$")
}

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret")
  if (secret !== "mis-reset-2026") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await connectToDatabase()
  const result = await User.updateOne(
    { email: "support@jlc.com" },
    { $set: { passwordHash: hashPassword("jlc4life"), forcedPasswordChange: false } }
  )

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true, message: "Password reset to: jlc4life" })
}
