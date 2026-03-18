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
    maxPoolSize: 30,
    minPoolSize: 5,
    maxIdleTimeMS: 30000,
  });
}

let cached = (global as any).mongoose || { conn: null, promise: null };

export async function connectToDatabase() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not set. Add it to your environment variables.');
  }

  if (cached.conn) {
    return cached.conn;
  }

  configureDnsForMongoSrv(MONGODB_URI);

  if (!cached.promise) {
    cached.promise = (async () => {
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
    })().catch((error: any) => {
      const message = String(error?.message || error);
      if (isSrvDnsError(error)) {
        throw new Error(
          'MongoDB DNS SRV lookup failed (querySrv ECONNREFUSED). Use a stable DNS (e.g. 8.8.8.8/1.1.1.1) or set MONGODB_URI to a direct mongodb:// Atlas URI.'
        );
      }
      throw new Error(message);
    });
  }
  cached.conn = await cached.promise;
  (global as any).mongoose = cached;
  return cached.conn;
}

export default connectToDatabase;