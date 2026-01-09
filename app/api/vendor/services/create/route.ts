import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const serviceData = await request.json()
    console.log('Creating service with data:', serviceData)
    
    // TODO: Implement real service creation with MongoDB Service model
    // For now, accept the service data and return success
    const newService = {
      id: Math.random().toString(36).substr(2, 9),
      ...serviceData,
      createdAt: new Date(),
    }
    
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