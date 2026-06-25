import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim() || ''
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '6'), 10)
  const scope = request.nextUrl.searchParams.get('scope') || 'products'

  if (q.length < 2) {
    return NextResponse.json({ suggestions: [], categories: [] })
  }

  try {
    const { db } = await connectToDatabase()
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')

    if (scope === 'services') {
      const services = await db
        .collection('services')
        .find(
          {
            $or: [{ title: regex }, { description: regex }, { providerName: regex }, { tags: regex }],
            status: 'active',
          },
          { projection: { _id: 1, title: 1, providerName: 1, price: 1, images: 1, category: 1 }, limit }
        )
        .toArray()

      const suggestions = services.map((s: any) => ({
        id: String(s._id),
        text: String(s.title || ''),
        category: s.category || null,
        price: s.price ? Number(s.price) : null,
        image: Array.isArray(s.images) && s.images[0] ? s.images[0] : null,
      }))

      const categories = await db
        .collection('services')
        .distinct('category', { category: regex, status: 'active' })

      return NextResponse.json(
        { suggestions, categories: (categories as string[]).filter(Boolean).slice(0, 4) },
        { headers: { 'Cache-Control': 'private, max-age=30' } }
      )
    }

    const products = await db
      .collection('products')
      .find(
        { $or: [{ title: regex }, { name: regex }], status: 'active' },
        {
          projection: { _id: 1, title: 1, name: 1, price: 1, images: 1, category: 1 },
          sort: { sales: -1 },
          limit,
        }
      )
      .toArray()

    const suggestions = products.map((p: any) => ({
      id: String(p._id),
      text: String(p.title || p.name || ''),
      category: p.category || null,
      price: p.price ? Number(p.price) : null,
      image: Array.isArray(p.images) && p.images[0] ? p.images[0] : null,
    }))

    const categories = await db
      .collection('products')
      .distinct('category', { category: regex, status: 'active' })

    return NextResponse.json(
      { suggestions, categories: (categories as string[]).filter(Boolean).slice(0, 4) },
      { headers: { 'Cache-Control': 'private, max-age=30' } }
    )
  } catch (err) {
    console.error('[search/suggestions]', err)
    return NextResponse.json({ suggestions: [], categories: [] })
  }
}
