import webpush from 'web-push'
import { connectToDatabase } from './mongodb'
import { ObjectId } from 'mongodb'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:support@makeitsell.ng',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export interface PushPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  url?: string
  tag?: string
}

const ICON = '/images/mis-icon.png'
const BADGE = '/images/mis-icon.png'

/**
 * Send a push notification to a single subscription record.
 * Returns true on success, false on permanent failure (expired/invalid).
 */
async function sendToSubscription(sub: any, payload: PushPayload): Promise<boolean> {
  try {
    await webpush.sendNotification(
      sub.subscription,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon ?? ICON,
        badge: payload.badge ?? BADGE,
        url: payload.url ?? '/',
        tag: payload.tag,
      })
    )
    return true
  } catch (err: any) {
    if (err?.statusCode === 410 || err?.statusCode === 404) {
      return false // subscription expired — caller should delete it
    }
    console.error('[push] sendNotification error:', err?.message)
    return true // transient error — keep subscription
  }
}

/**
 * Send a push notification to all subscriptions for a given userId.
 * Automatically removes expired subscriptions.
 */
export async function pushToUser(userId: string, payload: PushPayload) {
  const { db } = await connectToDatabase()
  let userQuery: any
  try { userQuery = { userId: new ObjectId(userId) } } catch { userQuery = { userId } }

  const subs = await db.collection('push_subscriptions').find(userQuery).toArray()
  if (!subs.length) return

  const expired: string[] = []
  await Promise.all(
    subs.map(async (sub: any) => {
      const ok = await sendToSubscription(sub, payload)
      if (!ok) expired.push(String(sub._id))
    })
  )
  if (expired.length) {
    await db.collection('push_subscriptions').deleteMany({
      _id: { $in: expired.map((id) => { try { return new ObjectId(id) } catch { return id } }) },
    })
  }
}

/**
 * Broadcast a push notification to ALL subscribers (e.g. site-wide announcements).
 * Processes in batches to avoid memory issues.
 */
export async function pushBroadcast(payload: PushPayload, batchSize = 200) {
  const { db } = await connectToDatabase()
  const expired: string[] = []
  let skip = 0

  while (true) {
    const batch = await db.collection('push_subscriptions').find({}).skip(skip).limit(batchSize).toArray()
    if (!batch.length) break
    await Promise.all(
      batch.map(async (sub: any) => {
        const ok = await sendToSubscription(sub, payload)
        if (!ok) expired.push(String(sub._id))
      })
    )
    if (expired.length > 100) {
      await db.collection('push_subscriptions').deleteMany({
        _id: { $in: expired.splice(0).map((id) => { try { return new ObjectId(id) } catch { return id } }) },
      })
    }
    skip += batchSize
    if (batch.length < batchSize) break
  }
  if (expired.length) {
    await db.collection('push_subscriptions').deleteMany({
      _id: { $in: expired.map((id) => { try { return new ObjectId(id) } catch { return id } }) },
    })
  }
}
