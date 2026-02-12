import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { emailService } from '@/lib/email'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    console.log('[migrate-users] POST request received')
    const { action, emailFilter } = await request.json()
    console.log('[migrate-users] Action:', action, 'Filter:', emailFilter)

    // Basic admin check (you might want to add proper admin authentication)
    const authHeader = request.headers.get('authorization')
    const adminKey = process.env.ADMIN_API_KEY || 'admin123' // Set a secure key in production
    
    console.log('[migrate-users] Auth header present:', !!authHeader)
    
    if (authHeader !== `Bearer ${adminKey}`) {
      console.log('[migrate-users] Auth failed - expected:', `Bearer ${adminKey}`, 'got:', authHeader)
      return NextResponse.json({
        success: false,
        error: 'Unauthorized - Admin access required'
      }, { status: 401 })
    }

    console.log('[migrate-users] Auth successful, connecting to database...')
    await connectToDatabase()
    console.log('[migrate-users] Database connected')

    if (action === 'migrate') {
      return await handleMigration(emailFilter)
    } else if (action === 'count') {
      return await countUnverifiedUsers(emailFilter)
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid action. Use "migrate" or "count"'
      }, { status: 400 })
    }

  } catch (error: any) {
    console.error('[migrate-users] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

async function countUnverifiedUsers(emailFilter?: string) {
  try {
    let query: any = {
      $or: [
        { isEmailVerified: { $exists: false } },
        { isEmailVerified: false }
      ]
    }

    if (emailFilter) {
      query.email = { $regex: emailFilter, $options: 'i' }
    }

    const count = await User.countDocuments(query)
    const users = await User.find(query, { email: 1, name: 1, createdAt: 1 }).limit(10)

    return NextResponse.json({
      success: true,
      count,
      sample: users.map(user => ({
        email: user.email,
        name: user.name,
        createdAt: user.createdAt
      })),
      message: count > 10 ? `Showing first 10 of ${count} users` : `Found ${count} unverified users`
    })

  } catch (error: any) {
    throw new Error(`Failed to count users: ${error.message}`)
  }
}

async function handleMigration(emailFilter?: string) {
  try {
    let query: any = {
      $or: [
        { isEmailVerified: { $exists: false } },
        { isEmailVerified: false }
      ]
    }

    if (emailFilter) {
      query.email = { $regex: emailFilter, $options: 'i' }
    }

    const unverifiedUsers = await User.find(query)

    if (unverifiedUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No unverified users found',
        processed: 0,
        successful: 0,
        failed: 0
      })
    }

    // Limit to 50 users per request to avoid timeouts
    const usersToProcess = unverifiedUsers.slice(0, 50)
    
    let successful = 0
    let failed = 0
    const failedEmails: string[] = []

    for (const user of usersToProcess) {
      try {
        // Generate verification token
        const emailVerificationToken = crypto.randomBytes(32).toString('hex')
        const emailVerificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

        // Update user
        user.isEmailVerified = false
        user.emailVerificationToken = emailVerificationToken
        user.emailVerificationTokenExpiry = emailVerificationTokenExpiry
        user.updatedAt = new Date()
        
        await user.save()

        // Send verification email
        const verificationUrl = `https://www.makeitsell.org/verify-email?token=${emailVerificationToken}`
        
        const emailSent = await emailService.sendEmailVerification({
          email: user.email,
          name: user.name || user.displayName || 'User',
          verificationUrl
        })

        if (emailSent) {
          successful++
          console.log(`[migrate-users] ✅ Sent to: ${user.email}`)
        } else {
          failed++
          failedEmails.push(user.email)
          console.log(`[migrate-users] ❌ Failed to send to: ${user.email}`)
        }

        // Small delay between emails
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (error: any) {
        failed++
        failedEmails.push(user.email)
        console.log(`[migrate-users] ❌ Error for ${user.email}: ${error.message}`)
      }
    }

    console.log(`[migrate-users] Migration completed: ${successful} success, ${failed} failed`)

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      processed: usersToProcess.length,
      successful,
      failed,
      failedEmails: failedEmails.slice(0, 10), // Only return first 10 failed emails
      remaining: unverifiedUsers.length - usersToProcess.length,
      hasMore: unverifiedUsers.length > 50
    })

  } catch (error: any) {
    throw new Error(`Migration failed: ${error.message}`)
  }
}

// GET endpoint for checking status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const emailFilter = searchParams.get('filter') || undefined

    // Basic admin check
    const authHeader = request.headers.get('authorization')
    const adminKey = process.env.ADMIN_API_KEY || 'admin123'
    
    if (authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized - Admin access required'
      }, { status: 401 })
    }

    await connectToDatabase()
    return await countUnverifiedUsers(emailFilter)

  } catch (error: any) {
    console.error('[migrate-users] GET Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}