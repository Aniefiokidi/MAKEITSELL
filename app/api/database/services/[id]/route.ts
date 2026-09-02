import { NextRequest, NextResponse } from 'next/server'
import { getServiceById as mongoGetServiceById } from '@/lib/mongodb-operations'
import { cacheNamespaces, getCachedPayload, setCachedPayload } from '@/lib/cache-store'
import { logApiPerformance } from '@/lib/performance-logs'
import { connectToDatabase } from '@/lib/mongodb'
import { Store } from '@/lib/models/Store'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const startedAt = Date.now()
  let statusCode = 200
  let cacheHit = false

  try {
    const { id } = await context.params
    console.log(`[getServiceById] Fetching service with id: ${id}`)
    if (!id) {
      statusCode = 400
      return NextResponse.json({ success: false, error: 'Missing service id' }, { status: 400 })
    }

    const cacheKey = JSON.stringify({ id })
    const cached = await getCachedPayload<any>(cacheNamespaces.servicesDetail, cacheKey)
    if (cached) {
      cacheHit = true
      statusCode = 200
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600'
        }
      })
    }

    const service: any = await mongoGetServiceById(id)
    console.log(`[getServiceById] Query result:`, service)
    if (!service) {
      statusCode = 404
      return NextResponse.json({ success: false, error: 'Service not found' }, { status: 404 })
    }

    // The provider's public contact number for the WhatsApp "Book" redirect
    // (app/service/[id]/page.tsx) — lives on Store.phone, NOT WhatsAppLink.waId (that's
    // the bot-linking number, private, unrelated to buyer-facing contact). Scoped to just
    // this single-service-detail route, not the shared getServiceById()/list-search path
    // used by browsing/bot hot paths.
    if (service.providerId) {
      await connectToDatabase()
      const store: any = await Store.findOne({ vendorId: service.providerId }).select('phone').lean()
      service.providerPhone = store?.phone || ''
    }

    const payload = { success: true, data: service }
    await setCachedPayload(cacheNamespaces.servicesDetail, cacheKey, payload, 120)

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600'
      }
    })
  } catch (error: any) {
    console.error('Get service by id error:', error)
    statusCode = 500
    return NextResponse.json({ success: false, error: error.message || 'Failed to fetch service' }, { status: 500 })
  } finally {
    void logApiPerformance({
      route: '/api/database/services/[id]',
      method: request.method,
      statusCode,
      durationMs: Date.now() - startedAt,
      cacheHit,
    })
  }
}
