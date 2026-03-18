import { NextRequest, NextResponse } from 'next/server'
import { getServices, deleteService } from '@/lib/mongodb-operations'
import { cacheNamespaces, invalidateCacheNamespace } from '@/lib/cache-store'
import { logApiPerformance } from '@/lib/performance-logs'

export async function GET(request: NextRequest) {
  const startedAt = Date.now()
  let statusCode = 200

  try {
    const { searchParams } = new URL(request.url)
    const providerId = searchParams.get('providerId')
    const search = searchParams.get('search')

    if (!providerId) {
      statusCode = 400
      return NextResponse.json({ error: 'Provider ID is required' }, { status: 400 })
    }

    let services = await getServices({ providerId })

    // Apply search filter if provided
    if (search) {
      const searchTerm = search.toLowerCase()
      services = services.filter((service: any) =>
        service.title?.toLowerCase().includes(searchTerm) ||
        service.description?.toLowerCase().includes(searchTerm) ||
        service.category?.toLowerCase().includes(searchTerm)
      )
    }

    return NextResponse.json({ services })
  } catch (error) {
    console.error('Error fetching vendor services:', error)
    statusCode = 500
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 })
  } finally {
    void logApiPerformance({
      route: '/api/vendor/services',
      method: request.method,
      statusCode,
      durationMs: Date.now() - startedAt,
      cacheHit: false,
    })
  }
}

export async function DELETE(request: NextRequest) {
  const startedAt = Date.now()
  let statusCode = 200

  try {
    const { searchParams } = new URL(request.url)
    const serviceId = searchParams.get('serviceId')

    if (!serviceId) {
      statusCode = 400
      return NextResponse.json({ error: 'Service ID is required' }, { status: 400 })
    }

    await deleteService(serviceId)
    await invalidateCacheNamespace(cacheNamespaces.servicesList)
    await invalidateCacheNamespace(cacheNamespaces.servicesDetail)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting service:', error)
    statusCode = 500
    return NextResponse.json({ error: 'Failed to delete service' }, { status: 500 })
  } finally {
    void logApiPerformance({
      route: '/api/vendor/services',
      method: request.method,
      statusCode,
      durationMs: Date.now() - startedAt,
      cacheHit: false,
    })
  }
}