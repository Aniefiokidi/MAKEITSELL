import crypto from 'crypto'

type CacheEntry = {
  value: unknown
  expiresAt: number
}

type StoreShape = {
  cache: Map<string, CacheEntry>
  versions: Map<string, number>
}

declare global {
  // eslint-disable-next-line no-var
  var __makeItSellCacheStore: StoreShape | undefined
}

const globalStore: StoreShape =
  global.__makeItSellCacheStore ||
  (global.__makeItSellCacheStore = {
    cache: new Map<string, CacheEntry>(),
    versions: new Map<string, number>(),
  })

const REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_REST_URL || ''
const REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_REST_TOKEN || ''

const hasRedis = Boolean(REDIS_REST_URL && REDIS_REST_TOKEN)

const hashIdentifier = (value: string) => crypto.createHash('sha1').update(value).digest('hex')

const buildRedisUrl = (path: string) => `${REDIS_REST_URL.replace(/\/$/, '')}${path}`

async function redisCommand(path: string): Promise<any | null> {
  if (!hasRedis) return null

  try {
    const response = await fetch(buildRedisUrl(path), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${REDIS_REST_TOKEN}`,
      },
      cache: 'no-store',
    })

    if (!response.ok) return null

    const data = await response.json().catch(() => null)
    return data
  } catch {
    return null
  }
}

async function getNamespaceVersion(namespace: string): Promise<number> {
  const memoryVersion = globalStore.versions.get(namespace)

  if (!hasRedis) {
    if (memoryVersion) return memoryVersion
    globalStore.versions.set(namespace, 1)
    return 1
  }

  const versionKey = `cache:version:${namespace}`
  const versionResult = await redisCommand(`/get/${encodeURIComponent(versionKey)}`)
  const parsedVersion = Number(versionResult?.result)

  if (Number.isFinite(parsedVersion) && parsedVersion > 0) {
    globalStore.versions.set(namespace, parsedVersion)
    return parsedVersion
  }

  const initialized = await redisCommand(`/set/${encodeURIComponent(versionKey)}/1`)
  if (initialized?.result === 'OK') {
    globalStore.versions.set(namespace, 1)
    return 1
  }

  if (memoryVersion) return memoryVersion
  globalStore.versions.set(namespace, 1)
  return 1
}

function buildVersionedKey(namespace: string, identifier: string, version: number): string {
  return `cache:${namespace}:v${version}:${hashIdentifier(identifier)}`
}

export async function getCachedPayload<T>(namespace: string, identifier: string): Promise<T | null> {
  const version = await getNamespaceVersion(namespace)
  const key = buildVersionedKey(namespace, identifier, version)

  const memoryHit = globalStore.cache.get(key)
  if (memoryHit && memoryHit.expiresAt > Date.now()) {
    return memoryHit.value as T
  }

  if (memoryHit && memoryHit.expiresAt <= Date.now()) {
    globalStore.cache.delete(key)
  }

  if (!hasRedis) return null

  const redisResult = await redisCommand(`/get/${encodeURIComponent(key)}`)
  if (!redisResult?.result) return null

  try {
    const parsed = JSON.parse(redisResult.result) as T
    return parsed
  } catch {
    return null
  }
}

export async function setCachedPayload<T>(
  namespace: string,
  identifier: string,
  payload: T,
  ttlSeconds: number
): Promise<void> {
  const version = await getNamespaceVersion(namespace)
  const key = buildVersionedKey(namespace, identifier, version)
  const expiresAt = Date.now() + ttlSeconds * 1000

  globalStore.cache.set(key, {
    value: payload,
    expiresAt,
  })

  if (!hasRedis) return

  const encodedValue = encodeURIComponent(JSON.stringify(payload))
  await redisCommand(`/setex/${encodeURIComponent(key)}/${ttlSeconds}/${encodedValue}`)
}

export async function invalidateCacheNamespace(namespace: string): Promise<void> {
  const nextMemoryVersion = (globalStore.versions.get(namespace) || 1) + 1
  globalStore.versions.set(namespace, nextMemoryVersion)

  // Best-effort memory cleanup of stale keys for this namespace.
  for (const key of globalStore.cache.keys()) {
    if (key.startsWith(`cache:${namespace}:`)) {
      globalStore.cache.delete(key)
    }
  }

  if (!hasRedis) return

  const versionKey = `cache:version:${namespace}`
  const result = await redisCommand(`/incr/${encodeURIComponent(versionKey)}`)
  const parsedVersion = Number(result?.result)
  if (Number.isFinite(parsedVersion) && parsedVersion > 0) {
    globalStore.versions.set(namespace, parsedVersion)
  }
}

export const cacheNamespaces = {
  productsList: 'products-list',
  productsDetail: 'products-detail',
  servicesList: 'services-list',
  servicesDetail: 'services-detail',
} as const
