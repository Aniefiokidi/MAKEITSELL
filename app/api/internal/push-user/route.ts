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

// Inline schemas — avoids model-already-registered errors in serverless
const PushSubSchema = new mongoose.Schema({ userId: mongoose.Schema.Types.Mixed, subscription: mongoose.Schema.Types.Mixed }, { collection: 'push_subscriptions' })
const PushSub = mongoose.models.PushSub || mongoose.model('PushSub', PushSubSchema)

const UserSchema = new mongoose.Schema({ uid: String, name: String, displayName: String, email: String }, { collection: 'users', strict: false })
const User = mongoose.models.InternalUser || mongoose.model('InternalUser', UserSchema)

// Temporary — DELETE AFTER USE
// POST /api/internal/push-user?secret=mis-push-2026
// Body: { "nameQuery": "osedy", "title": "...", "body": "...", "url": "/" }

export async function POST(request: NextRequest) {
  if (request.nextUrl.searchParams.get('secret') !== 'mis-push-2026') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    await connectToDatabase()

    const { nameQuery, email, title, body, url } = await request.json()

    // Find target user
    let query: any = {}
    if (email) {
      query = { email: new RegExp(email, 'i') }
    } else if (nameQuery) {
      query = { $or: [{ name: new RegExp(nameQuery, 'i') }, { displayName: new RegExp(nameQuery, 'i') }] }
    } else {
      return NextResponse.json({ error: 'Provide nameQuery or email' }, { status: 400 })
    }

    const targetUser = await User.findOne(query).lean() as any
    if (!targetUser) {
      const sample = await User.find({}).limit(5).select('name displayName email uid').lean()
      return NextResponse.json({ error: 'User not found', sample }, { status: 404 })
    }

    const uid: string = targetUser.uid || targetUser._id?.toString()
    const userName: string = targetUser.name || targetUser.displayName || 'Unknown'

    // Find push subscriptions
    const subs = await PushSub.find({
      $or: [{ userId: uid }, { userId: targetUser._id?.toString() }],
    }).lean() as any[]

    if (!subs.length) {
      const allSubs = await PushSub.find({}).limit(5).select('userId').lean()
      return NextResponse.json({
        found: true,
        user: { uid, name: userName, email: targetUser.email },
        warning: 'No push subscriptions found — user may not have notifications enabled',
        subsInDb: allSubs.map((s: any) => String(s.userId)),
      })
    }

    // Send to each subscription
    const results: any[] = []
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          sub.subscription,
          JSON.stringify({
            title: title || 'MakeItSell',
            body: body || '',
            icon: '/images/mis-icon.png',
            badge: '/images/mis-icon.png',
            url: url || '/',
          })
        )
        results.push({ ok: true })
      } catch (err: any) {
        results.push({ ok: false, statusCode: err?.statusCode, message: err?.message })
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await PushSub.deleteOne({ _id: (sub as any)._id })
        }
      }
    }

    return NextResponse.json({ ok: true, user: { uid, name: userName, email: targetUser.email }, results })
  } catch (err: any) {
    console.error('[push-user]', err)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
