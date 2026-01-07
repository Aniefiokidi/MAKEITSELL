// All exports in this file are stubbed to prevent client-side usage.
// Do not import this file in client components. Use API routes only.

const notServerError = () => {
  throw new Error('Mongoose cannot be used in client components. Use API routes instead.')
}

export default notServerError;
  }

  return cached.conn
}


export default connectToDatabase;
export { connectToDatabase };

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