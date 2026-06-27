export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { pushToUser } from '@/lib/push-notifications'

// Temporary one-use endpoint — DELETE AFTER USE
// Usage: POST /api/internal/push-user?secret=mis-push-2026
// Body: { "nameQuery": "osedy", "title": "...", "body": "...", "url": "/" }

export async function POST(request: NextRequest) {
  if (request.nextUrl.searchParams.get('secret') !== 'mis-push-2026') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const { nameQuery, email, userId, title, body, url } = await request.json()

    const { db } = await connectToDatabase()

    // Find user by name, email, or direct userId
    let targetUser: any = null

    if (userId) {
      targetUser = await db.collection('users').findOne({ $or: [{ _id: userId }, { uid: userId }] })
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
      return NextResponse.json({ error: 'User not found', query: { nameQuery, email, userId } }, { status: 404 })
    }

    const uid = targetUser.uid || targetUser._id?.toString()
    const userEmail = targetUser.email
    const userName = targetUser.name || targetUser.displayName || 'Unknown'

    // Check if they have push subscriptions
    const subs = await db.collection('push_subscriptions').find({
      $or: [{ userId: uid }, { userId: targetUser._id }],
    }).toArray()

    if (!subs.length) {
      return NextResponse.json({
        found: true,
        user: { uid, name: userName, email: userEmail },
        error: 'No push subscriptions found for this user — they may not have enabled notifications',
      }, { status: 200 })
    }

    await pushToUser(uid, {
      title: title || 'MakeItSell',
      body: body || 'Hello!',
      url: url || '/',
    })

    return NextResponse.json({
      ok: true,
      user: { uid, name: userName, email: userEmail },
      subscriptions: subs.length,
      notification: { title, body, url },
    })
  } catch (err: any) {
    console.error('[push-user]', err)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
