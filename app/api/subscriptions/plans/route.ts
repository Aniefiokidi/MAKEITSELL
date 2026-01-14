import { NextRequest, NextResponse } from 'next/server'
import { paystackService } from '@/lib/payment'

// Get or create the vendor subscription plan
export async function GET(request: NextRequest) {
  try {
    // Check if plan already exists in environment variable
    const existingPlanCode = process.env.PAYSTACK_VENDOR_PLAN_CODE
    
    if (existingPlanCode) {
      return NextResponse.json({
        success: true,
        planCode: existingPlanCode,
        message: 'Using existing plan'
      })
    }

    return NextResponse.json({
      success: false,
      message: 'No subscription plan configured. Please create one first.'
    }, { status: 404 })
  } catch (error) {
    console.error('Get plan error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get subscription plan'
    }, { status: 500 })
  }
}

// Create a new vendor subscription plan (one-time setup)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Default vendor subscription plan: ₦2,500/month
    const planData = {
      name: body.name || 'Vendor Monthly Subscription',
      amount: body.amount || 2500, // ₦2,500
      interval: 'monthly' as const,
      description: body.description || 'Monthly subscription for vendors on Make It Sell marketplace'
    }

    const result = await paystackService.createSubscriptionPlan(planData)

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: result.data,
        message: 'Subscription plan created successfully. Save the plan_code to your environment variables as PAYSTACK_VENDOR_PLAN_CODE'
      })
    }

    return NextResponse.json({
      success: false,
      error: result.message
    }, { status: 400 })
  } catch (error) {
    console.error('Create plan error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create subscription plan'
    }, { status: 500 })
  }
}
