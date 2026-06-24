import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'

export async function POST(request: NextRequest) {
  try {
    const { endpoint } = await request.json()
    if (!endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })

    const { db } = await connectToDatabase()
    await db.collection('push_subscriptions').deleteOne({ 'subscription.endpoint': endpoint })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[notifications/unsubscribe]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
