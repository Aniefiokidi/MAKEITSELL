// STUB: MongoDB connection is not available in this environment.
const notServerError = () => { throw new Error('MongoDB connection is not available in this environment.'); };
export default notServerError;
    throw error
  }
}

// Export database instance
export const getDbInstance = () => mongoose.connection.db