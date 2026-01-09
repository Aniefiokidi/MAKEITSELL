import { NextRequest, NextResponse } from 'next/server'
import { getServiceById as mongoGetServiceById } from '@/lib/mongodb-operations'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    console.log(`[getServiceById] Fetching service with id: ${id}`)
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing service id' }, { status: 400 })
    }
    const service = await mongoGetServiceById(id)
    console.log(`[getServiceById] Query result:`, service)
    if (!service) {
      return NextResponse.json({ success: false, error: 'Service not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: service })
  } catch (error: any) {
    console.error('Get service by id error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to fetch service' }, { status: 500 })
  }
}
