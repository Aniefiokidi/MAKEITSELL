import { NextRequest, NextResponse } from 'next/server'
import { createService } from '@/lib/mongodb-operations'

export async function POST(request: NextRequest) {
  try {
    const serviceData = await request.json()
    console.log('Creating service with data:', serviceData)

    const newService = await createService(serviceData)
    console.log('Service created successfully:', newService)

    return NextResponse.json({ service: newService }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating service:', error)
    console.error('Error details:', error.message, error.stack)
    return NextResponse.json({ 
      error: 'Failed to create service',
      details: error.message 
    }, { status: 500 })
  }
}