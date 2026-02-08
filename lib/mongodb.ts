import mongoose from 'mongoose';

// Get base URI and add database name if not present
const baseUri = process.env.MONGODB_URI || '';
const MONGODB_URI = baseUri.includes('/test') || baseUri.includes('/makeitsell') || baseUri.includes('/gote-marketplace') 
  ? baseUri 
  : baseUri + 'test';

let cached = (global as any).mongoose || { conn: null, promise: null };

export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    }).then((mongoose) => {
      return mongoose;
    });
  }
  cached.conn = await cached.promise;
  (global as any).mongoose = cached;
  return cached.conn;
}

export default connectToDatabase;