import { NextRequest, NextResponse } from 'next/server'
import { getServices as mongoGetServices } from '@/lib/mongodb-operations'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || undefined
    const providerId = searchParams.get('providerId') || undefined
    const featured = searchParams.get('featured') === 'true' ? true : undefined
    const locationType = searchParams.get('locationType') || undefined
    const limitCount = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined

    const services = await mongoGetServices({
      category,
      providerId,
      featured,
      locationType,
      limitCount
    })

    return NextResponse.json({ success: true, data: services })
  } catch (error: any) {
    console.error('Get services error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch services',
      data: []
    }, { status: 500 })
  }
}