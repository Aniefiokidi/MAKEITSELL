import { NextRequest, NextResponse } from 'next/server'
import { getServices as mongoGetServices } from '@/lib/mongodb-operations'
import { cacheNamespaces, getCachedPayload, setCachedPayload } from '@/lib/cache-store'
import { logApiPerformance } from '@/lib/performance-logs'

export async function GET(request: NextRequest) {
  const startedAt = Date.now()
  let statusCode = 200
  let cacheHit = false

  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || undefined
    const providerId = searchParams.get('providerId') || undefined
    const featured = searchParams.get('featured') === 'true' ? true : undefined
    const locationType = searchParams.get('locationType') || undefined
    const limitCount = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined

    const cacheKey = JSON.stringify({
      category: category || null,
      providerId: providerId || null,
      featured: featured ?? null,
      locationType: locationType || null,
      limitCount: limitCount || null,
    })

    const cached = await getCachedPayload<any>(cacheNamespaces.servicesList, cacheKey)
    if (cached) {
      cacheHit = true
      statusCode = 200
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
        }
      })
    }

    const services = await mongoGetServices({
      category,
      providerId,
      featured,
      locationType,
      limitCount
    })

    const payload = { success: true, data: services }
    await setCachedPayload(cacheNamespaces.servicesList, cacheKey, payload, 60)

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
      }
    })
  } catch (error: any) {
    console.error('Get services error:', error)
    statusCode = 500
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch services',
      data: []
    }, { status: 500 })
  } finally {
    void logApiPerformance({
      route: '/api/database/services',
      method: request.method,
      statusCode,
      durationMs: Date.now() - startedAt,
      cacheHit,
    })
  }
}