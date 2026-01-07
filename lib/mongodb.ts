import mongoose from 'mongoose'

// MongoDB connection configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gote-marketplace'

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local')
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = (global as any).mongoose

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null }
}

async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    }

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    throw e
  }

  return cached.conn
}

export default connectToDatabase

// Utility function to check if MongoDB is available
export const isMongoDBAvailable = async (): Promise<boolean> => {
  try {
    await connectToDatabase()
    return mongoose.connection.readyState === 1
  } catch (error) {
    console.warn("MongoDB is not available:", error)
    return false
  }
}

// Utility function to handle MongoDB operations gracefully when offline
export const withMongoDBRetry = async <T>(
  operation: () => Promise<T>,
  fallback: () => T
): Promise<T> => {
  try {
    return await operation()
  } catch (error: any) {
    if (error.message?.includes("ENOTFOUND") || error.message?.includes("ECONNREFUSED")) {
      console.log("MongoDB unavailable, using fallback")
      return fallback()
    }
    throw error
  }
}

// Export database instance
export const getDbInstance = () => mongoose.connection.db