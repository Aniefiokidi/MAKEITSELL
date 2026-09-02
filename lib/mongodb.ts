import mongoose from 'mongoose';
import dns from 'dns';

function ensureDatabaseName(uri: string, defaultDb = 'test') {
  if (!uri) return uri;

  const queryStart = uri.indexOf('?');
  const query = queryStart >= 0 ? uri.slice(queryStart) : '';
  const withoutQuery = queryStart >= 0 ? uri.slice(0, queryStart) : uri;

  const protocolIndex = withoutQuery.indexOf('://');
  if (protocolIndex < 0) return uri;

  const pathStart = withoutQuery.indexOf('/', protocolIndex + 3);
  if (pathStart < 0) {
    return `${withoutQuery}/${defaultDb}${query}`;
  }

  const currentPath = withoutQuery.slice(pathStart + 1);
  if (!currentPath) {
    return `${withoutQuery}${defaultDb}${query}`;
  }

  return uri;
}

const baseUri = process.env.MONGODB_URI || '';
const MONGODB_URI = ensureDatabaseName(baseUri, process.env.MONGODB_DB_NAME || 'test');
let dnsConfigured = false;

const configuredDnsServers = (process.env.MONGODB_DNS_SERVERS || '8.8.8.8,1.1.1.1')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

function configureDnsForMongoSrv(uri: string) {
  if (dnsConfigured || !uri.startsWith('mongodb+srv://')) return;

  if (configuredDnsServers.length === 0) return;

  dns.setServers(configuredDnsServers);
  dnsConfigured = true;
  console.log('[mongodb] Using DNS servers for SRV lookup:', configuredDnsServers.join(', '));
}

function isSrvDnsError(error: unknown) {
  const message = String((error as any)?.message || error || '');
  return (
    message.includes('querySrv ECONNREFUSED') ||
    message.includes('querySrv ENOTFOUND') ||
    message.includes('querySrv ETIMEOUT')
  );
}

function isSslError(error: unknown) {
  const message = String((error as any)?.message || error || '');
  return /ssl|tls|alert internal|certificate|0a000438/i.test(message);
}

function extractSearchParams(uri: URL) {
  const params = new URLSearchParams(uri.searchParams);
  if (!params.has('retryWrites')) params.set('retryWrites', 'true');
  if (!params.has('w')) params.set('w', 'majority');
  if (!params.has('tls')) params.set('tls', 'true');
  return params;
}

async function buildDirectUriFromSrv(srvUri: string) {
  const parsed = new URL(srvUri);
  const hostname = parsed.hostname;
  const dbName = parsed.pathname && parsed.pathname !== '/'
    ? parsed.pathname.replace(/^\//, '')
    : (process.env.MONGODB_DB_NAME || 'test');

  const resolver = new dns.promises.Resolver();
  if (configuredDnsServers.length > 0) {
    resolver.setServers(configuredDnsServers);
  }

  const srvRecords = await resolver.resolveSrv(`_mongodb._tcp.${hostname}`);
  if (!Array.isArray(srvRecords) || srvRecords.length === 0) {
    throw new Error('No MongoDB SRV records found for host');
  }

  const hosts = srvRecords
    .sort((a, b) => a.priority - b.priority)
    .map((record) => `${record.name}:${record.port}`)
    .join(',');

  const params = extractSearchParams(parsed);

  try {
    const txtRecords = await resolver.resolveTxt(hostname);
    if (Array.isArray(txtRecords) && txtRecords.length > 0) {
      const atlasTxt = txtRecords[0].join('');
      const atlasParams = new URLSearchParams(atlasTxt);
      atlasParams.forEach((value, key) => {
        if (!params.has(key)) params.set(key, value);
      });
    }
  } catch {
    // Optional TXT lookup; continue with defaults.
  }

  const username = parsed.username ? encodeURIComponent(decodeURIComponent(parsed.username)) : '';
  const password = parsed.password ? encodeURIComponent(decodeURIComponent(parsed.password)) : '';
  const auth = username ? `${username}${password ? `:${password}` : ''}@` : '';

  return `mongodb://${auth}${hosts}/${dbName}?${params.toString()}`;
}

function connectWithUri(uri: string) {
  return mongoose.connect(uri, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 10000,
    // Each Vercel serverless function instance gets its own connection pool (this cache
    // is per-instance, not shared across the fleet) — under real traffic, Vercel can run
    // many instances concurrently, so maxPoolSize multiplies by instance count. At 30/5
    // it takes only ~15-17 concurrent instances to hit the M0 tier's hard 500-connection
    // cap, which is exactly what triggered the Atlas connection-limit alert. Kept small
    // here so the fleet-wide ceiling stays well under that regardless of scale.
    maxPoolSize: 5,
    minPoolSize: 0,
    maxIdleTimeMS: 30000,
  });
}

let cached = (global as any).mongoose || { conn: null, promise: null };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Retries within a single request before giving up, on top of the existing
// cross-request self-heal below (which only helps the *next* request, not this one).
// Real-world trigger: a brief Atlas connection-limit/selection blip under a burst of
// concurrent serverless instances — gone by the next attempt a few hundred ms later,
// but without this, that one request still fails outright and surfaces as a raw 500 to
// whichever user happened to hit it (e.g. a password-reset attempt that failed once,
// then worked immediately on retry — the underlying blip, not the request, was transient).
const CONNECT_RETRY_DELAYS_MS = [300, 800];

async function connectOnce(): Promise<typeof mongoose> {
  try {
    return await connectWithUri(MONGODB_URI);
  } catch (error) {
    if (MONGODB_URI.startsWith('mongodb+srv://') && isSrvDnsError(error)) {
      console.warn('[mongodb] SRV lookup failed; attempting direct-host fallback connection');
      const directUri = await buildDirectUriFromSrv(MONGODB_URI);
      return await connectWithUri(directUri);
    }

    throw error;
  }
}

async function connectWithRetry(): Promise<typeof mongoose> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await connectOnce();
    } catch (error) {
      const isLastAttempt = attempt >= CONNECT_RETRY_DELAYS_MS.length;
      if (!isLastAttempt) {
        console.warn(
          `[mongodb] Connection attempt ${attempt + 1} failed, retrying in ${CONNECT_RETRY_DELAYS_MS[attempt]}ms:`,
          (error as any)?.message || error
        );
        await sleep(CONNECT_RETRY_DELAYS_MS[attempt]);
        continue;
      }

      // Reset cached promise so a later request (if this was a longer outage, not a
      // blip) starts a fresh attempt rather than replaying a permanently-failed one.
      cached.promise = null;
      (global as any).mongoose = cached;

      const message = String((error as any)?.message || error);
      if (isSrvDnsError(error)) {
        throw new Error(
          'MongoDB DNS SRV lookup failed (querySrv ECONNREFUSED). Use a stable DNS (e.g. 8.8.8.8/1.1.1.1) or set MONGODB_URI to a direct mongodb:// Atlas URI.'
        );
      }
      if (isSslError(error)) {
        throw new Error('Database connection failed (TLS error). Please try again.');
      }
      throw new Error(message);
    }
  }
}

export async function connectToDatabase() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not set. Add it to your environment variables.');
  }

  if (cached.conn) {
    return cached.conn;
  }

  configureDnsForMongoSrv(MONGODB_URI);

  if (!cached.promise) {
    cached.promise = connectWithRetry();
  }
  cached.conn = await cached.promise;
  (global as any).mongoose = cached;
  return cached.conn;
}

export default connectToDatabase;