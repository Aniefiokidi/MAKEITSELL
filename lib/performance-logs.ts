import mongoose from 'mongoose'
import connectToDatabase from '@/lib/mongodb'

export type ApiPerformanceLogInput = {
  route: string
  method: string
  statusCode: number
  durationMs: number
  cacheHit?: boolean
  metadata?: Record<string, unknown>
}

let indexesEnsured = false

async function ensureIndexes() {
  if (indexesEnsured) return

  await connectToDatabase()
  const db = mongoose.connection.db
  if (!db) return

  await db.collection('performance_logs').createIndex({ createdAt: -1 })
  await db.collection('performance_logs').createIndex({ route: 1, createdAt: -1 })
  indexesEnsured = true
}

export async function logApiPerformance(input: ApiPerformanceLogInput): Promise<void> {
  try {
    await ensureIndexes()
    const db = mongoose.connection.db
    if (!db) return

    await db.collection('performance_logs').insertOne({
      route: input.route,
      method: input.method,
      statusCode: input.statusCode,
      durationMs: input.durationMs,
      cacheHit: Boolean(input.cacheHit),
      metadata: input.metadata || {},
      createdAt: new Date(),
    })
  } catch {
    // Never fail API response flow because logging failed.
  }
}

export async function getRecentPerformanceLogs(limit = 200) {
  await ensureIndexes()
  const db = mongoose.connection.db
  if (!db) return []

  return db
    .collection('performance_logs')
    .find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray()
}
