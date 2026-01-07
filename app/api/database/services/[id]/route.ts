import { NextRequest, NextResponse } from 'next/server'
import { getServiceById as mongoGetServiceById } from '@/lib/mongodb-operations'

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  try {
    const id = context.params.id
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing service id' }, { status: 400 })
    }
    const service = await mongoGetServiceById(id)
    if (!service) {
      return NextResponse.json({ success: false, error: 'Service not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: service })
  } catch (error: any) {
    console.error('Get service by id error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch service' }, { status: 500 })
  }
}
