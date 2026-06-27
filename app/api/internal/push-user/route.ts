export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import mongoose from 'mongoose'
import webpush from 'web-push'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:support@makeitsell.ng',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

const PushSubSchema = new mongoose.Schema({ subscription: mongoose.Schema.Types.Mixed, userId: mongoose.Schema.Types.Mixed }, { collection: 'push_subscriptions' })
const PushSub = mongoose.models.PushSubDebug || mongoose.model('PushSubDebug', PushSubSchema)
const UserSchema = new mongoose.Schema({ uid: String, name: String, displayName: String, email: String }, { collection: 'users', strict: false })
const User = mongoose.models.InternalUserDebug || mongoose.model('InternalUserDebug', UserSchema)

// POST /api/internal/push-user?secret=mis-push-2026
// GET  /api/internal/push-user?secret=mis-push-2026&check=osedy  ← inspect subs

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get('secret') !== 'mis-push-2026') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  await connectToDatabase()
  const nameQuery = request.nextUrl.searchParams.get('check') || 'osedy'
  const user = await User.findOne({ $or: [{ name: new RegExp(nameQuery, 'i') }, { displayName: new RegExp(nameQuery, 'i') }] }).lean() as any
  if (!user) return NextResponse.json({ error: 'user not found' })
  const uid = user.uid || user._id?.toString()
  const subs = await PushSub.find({ $or: [{ userId: uid }, { userId: user._id?.toString() }] }).lean() as any[]
  return NextResponse.json({
    user: { uid, name: user.name || user.displayName, email: user.email },
    subscriptions: subs.map((s: any) => ({
      id: s._id,
      userId: s.userId,
      endpoint: s.subscription?.endpoint?.slice(0, 80) + '...',
      keys: s.subscription?.keys ? Object.keys(s.subscription.keys) : [],
    })),
  })
}

export async function POST(request: NextRequest) {
  if (request.nextUrl.searchParams.get('secret') !== 'mis-push-2026') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  try {
    await connectToDatabase()
    const { nameQuery, title, body, url } = await request.json()
    const user = await User.findOne({ $or: [{ name: new RegExp(nameQuery, 'i') }, { displayName: new RegExp(nameQuery, 'i') }] }).lean() as any
    if (!user) return NextResponse.json({ error: 'user not found' }, { status: 404 })
    const uid = user.uid || user._id?.toString()
    const subs = await PushSub.find({ $or: [{ userId: uid }, { userId: user._id?.toString() }] }).lean() as any[]
    if (!subs.length) return NextResponse.json({ error: 'no subscriptions', uid })
    const results: any[] = []
    for (const sub of subs) {
      try {
        const res = await webpush.sendNotification(sub.subscription, JSON.stringify({ title, body, icon: '/images/mis-icon.png', badge: '/images/mis-icon.png', url: url || '/', tag: 'mis-promo' }))
        results.push({ statusCode: res.statusCode, ok: true })
      } catch (err: any) {
        results.push({ ok: false, statusCode: err?.statusCode, body: err?.body, message: err?.message })
      }
    }
    return NextResponse.json({ user: { uid, name: user.name || user.displayName }, results })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
