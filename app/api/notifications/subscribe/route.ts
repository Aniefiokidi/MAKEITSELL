import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { subscription, userId } = body

    if (!subscription?.endpoint) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
    }

    const { db } = await connectToDatabase()

    // Upsert by endpoint — same browser tab won't create duplicates
    await db.collection('push_subscriptions').updateOne(
      { 'subscription.endpoint': subscription.endpoint },
      {
        $set: {
          subscription,
          userId: userId ? (() => { try { return new ObjectId(userId) } catch { return userId } })() : null,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[notifications/subscribe]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
