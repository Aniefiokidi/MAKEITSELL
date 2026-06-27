export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import mongoose from 'mongoose'

const PushSubSchema = new mongoose.Schema({
  subscription: mongoose.Schema.Types.Mixed,
  userId: mongoose.Schema.Types.Mixed,
}, { collection: 'push_subscriptions' })

const PushSub = mongoose.models.PushSubModelUnsub || mongoose.model('PushSubModelUnsub', PushSubSchema)

export async function POST(request: NextRequest) {
  try {
    const { endpoint } = await request.json()
    if (!endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })

    await connectToDatabase()
    await PushSub.deleteOne({ 'subscription.endpoint': endpoint })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[notifications/unsubscribe]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
