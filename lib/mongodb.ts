// STUB: MongoDB connection is not available in this environment.
export function connectToDatabase() {
  throw new Error("Server-only: connectToDatabase is not available on client.");
}

export default function notServerError() {
  throw new Error('MongoDB connection is not available in this environment.');
}