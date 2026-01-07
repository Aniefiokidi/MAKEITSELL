// Stub for connectToDatabase (do not use on client)
export function connectToDatabase() {
	throw new Error("Server-only: connectToDatabase is not available on client.");
}

// Default export stub
export default function() {
	throw new Error("Server-only: mongodb default export is not available on client.");
}
// STUB: MongoDB connection is not available in this environment.
const notServerError = () => { throw new Error('MongoDB connection is not available in this environment.'); };
export default notServerError;