import { NextRequest, NextResponse } from 'next/server'
import { getServiceById, updateService } from '@/lib/mongodb-operations'
import { cacheNamespaces, invalidateCacheNamespace } from '@/lib/cache-store'
import { logApiPerformance } from '@/lib/performance-logs'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const startedAt = Date.now()
  let statusCode = 200

  try {
    const { id } = await context.params
    if (!id) {
      statusCode = 400
      return NextResponse.json({ error: 'Service ID is required' }, { status: 400 })
    }

    const service = await getServiceById(id)
    if (!service) {
      statusCode = 404
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    return NextResponse.json({ service })
  } catch (error: any) {
    console.error('Error fetching vendor service:', error)
    statusCode = 500
    return NextResponse.json({ error: 'Failed to fetch service' }, { status: 500 })
  } finally {
    void logApiPerformance({
      route: '/api/vendor/services/[id]',
      method: request.method,
      statusCode,
      durationMs: Date.now() - startedAt,
      cacheHit: false,
    })
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const startedAt = Date.now()
  let statusCode = 200

  try {
    const { id } = await context.params
    if (!id) {
      statusCode = 400
      return NextResponse.json({ error: 'Service ID is required' }, { status: 400 })
    }

    const body = await request.json()

    const patch: any = {}

    if (typeof body.title === 'string') patch.title = body.title.trim()
    if (typeof body.description === 'string') patch.description = body.description.trim()
    if (typeof body.category === 'string') patch.category = body.category.trim()
    if (typeof body.subcategory === 'string') patch.subcategory = body.subcategory.trim()
    if (typeof body.locationType === 'string') patch.locationType = body.locationType
    if (typeof body.location === 'string') patch.location = body.location.trim()
    if (typeof body.state === 'string') patch.state = body.state.trim()
    if (typeof body.city === 'string') patch.city = body.city.trim()
    if (typeof body.status === 'string') patch.status = body.status

    if (Array.isArray(body.images)) {
      patch.images = body.images.filter((img: any) => typeof img === 'string' && img.trim())
    }

    if (Array.isArray(body.tags)) {
      patch.tags = body.tags.filter((tag: any) => typeof tag === 'string' && tag.trim())
    }

    if (Array.isArray(body.packageOptions)) {
      patch.packageOptions = body.packageOptions
        .filter((pkg: any) => pkg && pkg.name && Number(pkg.price) >= 0)
        .map((pkg: any) => ({
          ...pkg,
          images: Array.isArray(pkg.images)
            ? pkg.images
                .filter((img: any) => typeof img === 'string' && img.trim())
                .slice(0, 5)
            : [],
        }))
    }

    if (Array.isArray(body.addOnOptions)) {
      patch.addOnOptions = body.addOnOptions
    }

    if (typeof body.price !== 'undefined') {
      const numericPrice = Number(body.price)
      if (Number.isFinite(numericPrice) && numericPrice >= 0) {
        patch.price = numericPrice
      }
    }

    if (typeof body.pricingType === 'string') patch.pricingType = body.pricingType

    if (typeof body.duration !== 'undefined') {
      const numericDuration = Number(body.duration)
      if (Number.isFinite(numericDuration) && numericDuration > 0) {
        patch.duration = numericDuration
      }
    }

    if (Object.keys(patch).length === 0) {
      statusCode = 400
      return NextResponse.json({ error: 'No valid fields provided for update' }, { status: 400 })
    }

    patch.updatedAt = new Date()

    const service = await updateService(id, patch)
    if (!service) {
      statusCode = 404
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    await invalidateCacheNamespace(cacheNamespaces.servicesList)
    await invalidateCacheNamespace(cacheNamespaces.servicesDetail)

    return NextResponse.json({ service })
  } catch (error: any) {
    console.error('Error updating vendor service:', error)
    statusCode = 500
    return NextResponse.json({ error: error?.message || 'Failed to update service' }, { status: 500 })
  } finally {
    void logApiPerformance({
      route: '/api/vendor/services/[id]',
      method: request.method,
      statusCode,
      durationMs: Date.now() - startedAt,
      cacheHit: false,
    })
  }
}
