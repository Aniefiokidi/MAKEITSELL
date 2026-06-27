export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import mongoose from 'mongoose'

const PushSubSchema = new mongoose.Schema({
  subscription: mongoose.Schema.Types.Mixed,
  userId: mongoose.Schema.Types.Mixed,
  updatedAt: Date,
  createdAt: Date,
}, { collection: 'push_subscriptions' })

const PushSub = mongoose.models.PushSubModel || mongoose.model('PushSubModel', PushSubSchema)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { subscription, userId } = body

    if (!subscription?.endpoint) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
    }

    await connectToDatabase()

    await PushSub.updateOne(
      { 'subscription.endpoint': subscription.endpoint },
      {
        $set: {
          subscription,
          userId: userId || null,
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
