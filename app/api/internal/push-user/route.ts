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

// Temporary endpoint — DELETE AFTER USE
// POST /api/internal/push-user?secret=mis-push-2026
// Body: { "nameQuery": "osedy", "title": "...", "body": "...", "url": "/" }

export async function POST(request: NextRequest) {
  if (request.nextUrl.searchParams.get('secret') !== 'mis-push-2026') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const { nameQuery, email, userId, title, body, url } = await request.json()

    await connectToDatabase()
    const db = mongoose.connection.db!

    // Find user
    let targetUser: any = null
    if (userId) {
      targetUser = await db.collection('users').findOne({ $or: [{ uid: userId }, { _id: userId }] })
    } else if (email) {
      targetUser = await db.collection('users').findOne({ email: new RegExp(email, 'i') })
    } else if (nameQuery) {
      targetUser = await db.collection('users').findOne({
        $or: [
          { name: new RegExp(nameQuery, 'i') },
          { displayName: new RegExp(nameQuery, 'i') },
        ],
      })
    }

    if (!targetUser) {
      // List a few users to help debug
      const sample = await db.collection('users').find({}).limit(5).project({ name: 1, displayName: 1, email: 1, uid: 1 }).toArray()
      return NextResponse.json({ error: 'User not found', sample }, { status: 404 })
    }

    const uid = targetUser.uid || targetUser._id?.toString()
    const userName = targetUser.name || targetUser.displayName || 'Unknown'
    const userEmail = targetUser.email

    // Find push subscriptions (try both uid string and ObjectId)
    const subs = await db.collection('push_subscriptions').find({
      $or: [
        { userId: uid },
        { userId: targetUser._id },
        { userId: targetUser._id?.toString() },
      ],
    }).toArray()

    if (!subs.length) {
      // Show what's in push_subscriptions to help debug
      const allSubs = await db.collection('push_subscriptions').find({}).limit(10).project({ userId: 1, 'subscription.endpoint': 1 }).toArray()
      return NextResponse.json({
        found: true,
        user: { uid, name: userName, email: userEmail },
        error: 'No push subscriptions found — user may not have enabled notifications',
        allSubsSample: allSubs,
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
            body: body || 'Hello!',
            icon: '/images/mis-icon.png',
            badge: '/images/mis-icon.png',
            url: url || '/',
          })
        )
        results.push({ endpoint: sub.subscription?.endpoint?.slice(-30), status: 'sent' })
      } catch (err: any) {
        results.push({ endpoint: sub.subscription?.endpoint?.slice(-30), status: 'failed', code: err?.statusCode })
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await db.collection('push_subscriptions').deleteOne({ _id: sub._id })
        }
      }
    }

    return NextResponse.json({
      ok: true,
      user: { uid, name: userName, email: userEmail },
      results,
    })
  } catch (err: any) {
    console.error('[push-user]', err)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
