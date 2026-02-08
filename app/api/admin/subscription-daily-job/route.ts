import { NextRequest, NextResponse } from 'next/server'
import { SubscriptionManagementService } from '@/lib/subscription-management'

export async function POST(request: NextRequest) {
  try {
    // Basic security check
    const authHeader = request.headers.get('authorization')
    
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Running daily subscription management job...')

    // Run the daily subscription job
    const result = await SubscriptionManagementService.runDailySubscriptionJob()

    console.log('Daily subscription job completed:', result)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results: result.results,
      message: 'Daily subscription management job completed successfully'
    })

  } catch (error) {
    console.error('Daily subscription job error:', error)
    return NextResponse.json(
      { 
        error: 'Daily subscription job failed',
        details: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// Manual trigger endpoint (for testing)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')
    
    if (secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await SubscriptionManagementService.runDailySubscriptionJob()

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results: result.results,
      message: 'Manual subscription job completed successfully'
    })

  } catch (error) {
    console.error('Manual subscription job error:', error)
    return NextResponse.json(
      { 
        error: 'Manual subscription job failed',
        details: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}