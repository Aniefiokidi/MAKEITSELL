import { NextRequest, NextResponse } from 'next/server'
import { serialize } from 'cookie'
import { signIn } from '@/lib/auth'
import crypto from 'crypto'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { enforceRateLimit } from '@/lib/rate-limit'
import { hashPassword } from '@/lib/password'

const LOGISTICS_USERNAME = process.env.LOGISTICS_USERNAME || ''
const LOGISTICS_PASSWORD = process.env.LOGISTICS_PASSWORD || ''

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(request, {
      key: 'auth-signin',
      maxRequests: 10,
      windowMs: 60_000,
    })
    if (rateLimitResponse) return rateLimitResponse

    const { email, password } = await request.json()

    // Ensure requested logistics credentials can log in from the normal login page.
    if (LOGISTICS_USERNAME && LOGISTICS_PASSWORD && email === LOGISTICS_USERNAME && password === LOGISTICS_PASSWORD) {
      await connectToDatabase()

      const sessionToken = crypto.randomBytes(32).toString('hex')
      const passwordHash = hashPassword(LOGISTICS_PASSWORD)

      let logisticsUser = await User.findOne({ email: LOGISTICS_USERNAME })
      if (!logisticsUser) {
        logisticsUser = await User.create({
          email: LOGISTICS_USERNAME,
          passwordHash,
          name: 'A&CO Logistics',
          role: 'csa',
          isEmailVerified: true,
          sessionToken,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      } else {
        await User.updateOne(
          { _id: logisticsUser._id },
          {
            $set: {
              passwordHash,
              name: logisticsUser.name || 'A&CO Logistics',
              role: logisticsUser.role || 'csa',
              isEmailVerified: true,
              sessionToken,
              updatedAt: new Date(),
            },
          }
        )
      }

      const cookie = serialize('sessionToken', sessionToken, {
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      })

      return new NextResponse(
        JSON.stringify({
          success: true,
          user: {
            id: String(logisticsUser._id),
            email: LOGISTICS_USERNAME,
            name: logisticsUser.name || 'A&CO Logistics',
            role: logisticsUser.role || 'csa',
            walletBalance: typeof logisticsUser.walletBalance === 'number' ? logisticsUser.walletBalance : 0,
          },
        }),
        {
          status: 200,
          headers: { 'Set-Cookie': cookie, 'Content-Type': 'application/json' },
        }
      )
    }

    // Try MongoDB authentication
    try {
      console.log('[/api/auth/signin] Signing in user:', email);
      const result = await signIn({ email, password })
      console.log('[/api/auth/signin] signIn result:', result.success ? 'SUCCESS' : 'FAILED');
      if (result.success && result.sessionToken) {
        // Set HTTP-only cookie
        const cookie = serialize('sessionToken', result.sessionToken, {
          httpOnly: true,
          path: '/',
          maxAge: 60 * 60 * 24 * 30, // 30 days
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        })
        const safePayload = {
          ...result,
          sessionToken: undefined,
        }

        return new NextResponse(JSON.stringify(safePayload), {
          status: 200,
          headers: { 'Set-Cookie': cookie, 'Content-Type': 'application/json' },
        })
      }
      return NextResponse.json(result)
    } catch (mongoError: any) {
      const message = mongoError?.message || 'Authentication failed'
      console.log('[/api/auth/signin] Auth error:', message);

      const isDbConnectivityError =
        message.includes('querySrv ECONNREFUSED') ||
        message.includes('ENOTFOUND') ||
        message.includes('ECONNREFUSED') ||
        message.includes('MongoServerSelectionError') ||
        message.includes('MongooseServerSelectionError')

      return NextResponse.json({
        success: false,
        error: message
      }, { status: isDbConnectivityError ? 503 : 401 })
    }
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Server error during authentication'
    }, { status: 500 })
  }
}