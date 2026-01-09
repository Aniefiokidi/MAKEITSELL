import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'

export async function GET(request: NextRequest) {
  try {
    // Test MongoDB connection only
    await connectToDatabase()
    return NextResponse.json({
      success: true,
      message: 'MongoDB connected successfully!'
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()
    return NextResponse.json({ success: true, message: 'Test endpoint active' })
  } catch (error: any) {
    console.error('Sample data creation error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}