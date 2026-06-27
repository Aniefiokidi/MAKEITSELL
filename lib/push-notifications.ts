import webpush from 'web-push'
import connectToDatabase from './mongodb'
import mongoose from 'mongoose'

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

function getPushSubModel() {
  const schema = new mongoose.Schema({
    subscription: mongoose.Schema.Types.Mixed,
    userId: mongoose.Schema.Types.Mixed,
    updatedAt: Date,
    createdAt: Date,
  }, { collection: 'push_subscriptions' })
  return mongoose.models.PushSubLib || mongoose.model('PushSubLib', schema)
}

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
      return false
    }
    console.error('[push] sendNotification error:', err?.message)
    return true
  }
}

export async function pushToUser(userId: string, payload: PushPayload) {
  await connectToDatabase()
  const PushSub = getPushSubModel()

  const subs = await PushSub.find({
    $or: [{ userId }, { userId: userId.toString() }],
  }).lean() as any[]

  if (!subs.length) return

  const expired: any[] = []
  await Promise.all(
    subs.map(async (sub: any) => {
      const ok = await sendToSubscription(sub, payload)
      if (!ok) expired.push(sub._id)
    })
  )
  if (expired.length) {
    await PushSub.deleteMany({ _id: { $in: expired } })
  }
}

export async function pushBroadcast(payload: PushPayload, batchSize = 200) {
  await connectToDatabase()
  const PushSub = getPushSubModel()

  const expired: any[] = []
  let skip = 0

  while (true) {
    const batch = await PushSub.find({}).skip(skip).limit(batchSize).lean() as any[]
    if (!batch.length) break
    await Promise.all(
      batch.map(async (sub: any) => {
        const ok = await sendToSubscription(sub, payload)
        if (!ok) expired.push(sub._id)
      })
    )
    if (expired.length > 100) {
      await PushSub.deleteMany({ _id: { $in: expired.splice(0) } })
    }
    skip += batchSize
    if (batch.length < batchSize) break
  }
  if (expired.length) {
    await PushSub.deleteMany({ _id: { $in: expired } })
  }
}
