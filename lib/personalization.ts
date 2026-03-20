type ActivitySearch = {
  query: string
  scope: "products" | "stores" | "services" | "site"
  ts: number
}

type ActivityProductQuickView = {
  id: string
  category?: string
  title?: string
  storeName?: string
  ts: number
}

type ActivityStoreView = {
  id: string
  name?: string
  category?: string
  location?: string
  ts: number
}

type UserActivity = {
  searches: ActivitySearch[]
  productQuickViews: ActivityProductQuickView[]
  storeViews: ActivityStoreView[]
}

type SyncServerResponse = {
  success?: boolean
  activity?: UserActivity
}

type ProductLike = {
  id?: string
  _id?: string
  title?: string
  name?: string
  description?: string
  category?: string
  storeName?: string
  vendorName?: string
  sales?: number
}

type StoreLike = {
  id?: string
  _id?: string
  name?: string
  storeName?: string
  category?: string
  location?: string
  city?: string
  productCount?: number
}

const USER_ACTIVITY_KEY = "mis:user-activity:v1"
const MAX_SEARCH_EVENTS = 60
const MAX_PRODUCT_QUICK_VIEWS = 80
const MAX_STORE_VIEWS = 80
const SYNC_DEBOUNCE_MS = 2200
const SYNC_COOLDOWN_MS = 8000

let syncTimer: ReturnType<typeof setTimeout> | null = null
let syncInFlight = false
let lastSyncedAt = 0
let syncAvailability: boolean | null = null
let initStarted = false

const canUseStorage = () => typeof window !== "undefined"

const toId = (value: unknown) => String(value || "").trim()

const normalizeText = (value: unknown) => String(value || "").toLowerCase().trim()

const tokenize = (text: string) =>
  normalizeText(text)
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)

const uniqueRecent = <T>(items: T[], keyFn: (item: T) => string, max: number) => {
  const seen = new Set<string>()
  const output: T[] = []

  for (const item of items) {
    const key = keyFn(item)
    if (!key || seen.has(key)) continue
    seen.add(key)
    output.push(item)
    if (output.length >= max) break
  }

  return output
}

const getDefaultActivity = (): UserActivity => ({
  searches: [],
  productQuickViews: [],
  storeViews: [],
})

const loadActivity = (): UserActivity => {
  if (!canUseStorage()) return getDefaultActivity()

  try {
    const raw = localStorage.getItem(USER_ACTIVITY_KEY)
    if (!raw) return getDefaultActivity()
    const parsed = JSON.parse(raw)

    return {
      searches: Array.isArray(parsed?.searches) ? parsed.searches : [],
      productQuickViews: Array.isArray(parsed?.productQuickViews) ? parsed.productQuickViews : [],
      storeViews: Array.isArray(parsed?.storeViews) ? parsed.storeViews : [],
    }
  } catch {
    return getDefaultActivity()
  }
}

const saveActivity = (activity: UserActivity) => {
  if (!canUseStorage()) return
  try {
    localStorage.setItem(USER_ACTIVITY_KEY, JSON.stringify(activity))
  } catch {
    // Ignore storage quota errors.
  }
}

const mergeActivities = (base: UserActivity, incoming: UserActivity): UserActivity => ({
  searches: uniqueRecent(
    [...(incoming.searches || []), ...(base.searches || [])],
    (item) => `${normalizeText(item.scope)}:${normalizeText(item.query)}`,
    MAX_SEARCH_EVENTS
  ),
  productQuickViews: uniqueRecent(
    [...(incoming.productQuickViews || []), ...(base.productQuickViews || [])],
    (item) => toId(item.id),
    MAX_PRODUCT_QUICK_VIEWS
  ),
  storeViews: uniqueRecent(
    [...(incoming.storeViews || []), ...(base.storeViews || [])],
    (item) => toId(item.id),
    MAX_STORE_VIEWS
  ),
})

const parseServerActivity = (payload: unknown): UserActivity | null => {
  const typed = payload as SyncServerResponse
  if (!typed?.success || !typed?.activity) return null

  return {
    searches: Array.isArray(typed.activity.searches) ? typed.activity.searches : [],
    productQuickViews: Array.isArray(typed.activity.productQuickViews) ? typed.activity.productQuickViews : [],
    storeViews: Array.isArray(typed.activity.storeViews) ? typed.activity.storeViews : [],
  }
}

const pushLocalActivityToServer = async (force = false) => {
  if (!canUseStorage() || syncInFlight || syncAvailability === false) return

  const now = Date.now()
  if (!force && now - lastSyncedAt < SYNC_COOLDOWN_MS) return

  syncInFlight = true
  try {
    const activity = loadActivity()
    const response = await fetch("/api/user/personalization", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activity }),
    })

    if (response.status === 401 || response.status === 403) {
      syncAvailability = false
      return
    }

    if (!response.ok) return

    syncAvailability = true
    lastSyncedAt = now

    const data = (await response.json()) as SyncServerResponse
    const serverActivity = parseServerActivity(data)
    if (!serverActivity) return

    const merged = mergeActivities(activity, serverActivity)
    saveActivity(merged)
  } catch {
    // Ignore sync errors so personalization continues working offline.
  } finally {
    syncInFlight = false
  }
}

const scheduleServerSync = () => {
  if (!canUseStorage() || syncAvailability === false) return

  if (!initStarted) {
    void initPersonalizationSync()
  }

  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    void pushLocalActivityToServer(false)
  }, SYNC_DEBOUNCE_MS)
}

export const initPersonalizationSync = async () => {
  if (!canUseStorage() || initStarted) return

  initStarted = true

  try {
    const response = await fetch("/api/user/personalization", {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })

    if (response.status === 401 || response.status === 403) {
      syncAvailability = false
      return
    }

    if (!response.ok) {
      syncAvailability = false
      return
    }

    syncAvailability = true
    const data = (await response.json()) as SyncServerResponse
    const serverActivity = parseServerActivity(data)
    if (!serverActivity) return

    const localActivity = loadActivity()
    const merged = mergeActivities(localActivity, serverActivity)
    saveActivity(merged)

    // One immediate push ensures server also receives local-only signals.
    await pushLocalActivityToServer(true)
  } catch {
    syncAvailability = false
  }
}

export const trackSearch = (query: string, scope: ActivitySearch["scope"]) => {
  const normalized = normalizeText(query)
  if (normalized.length < 2) return

  const now = Date.now()
  const activity = loadActivity()

  const nextSearches = uniqueRecent(
    [{ query: normalized, scope, ts: now }, ...activity.searches],
    (item) => `${item.scope}:${item.query}`,
    MAX_SEARCH_EVENTS
  )

  saveActivity({ ...activity, searches: nextSearches })
  scheduleServerSync()
}

export const trackProductQuickView = (product: {
  id?: string
  _id?: string
  category?: string
  title?: string
  name?: string
  storeName?: string
  vendorName?: string
}) => {
  const id = toId(product.id || product._id)
  if (!id) return

  const activity = loadActivity()
  const now = Date.now()

  const nextQuickViews = uniqueRecent(
    [
      {
        id,
        category: normalizeText(product.category),
        title: product.title || product.name,
        storeName: normalizeText(product.storeName || product.vendorName),
        ts: now,
      },
      ...activity.productQuickViews,
    ],
    (item) => item.id,
    MAX_PRODUCT_QUICK_VIEWS
  )

  saveActivity({ ...activity, productQuickViews: nextQuickViews })
  scheduleServerSync()
}

export const trackStoreView = (store: {
  id?: string
  _id?: string
  name?: string
  storeName?: string
  category?: string
  location?: string
  city?: string
}) => {
  const id = toId(store.id || store._id)
  if (!id) return

  const activity = loadActivity()
  const now = Date.now()

  const nextViews = uniqueRecent(
    [
      {
        id,
        name: store.name || store.storeName,
        category: normalizeText(store.category),
        location: normalizeText(store.location || store.city),
        ts: now,
      },
      ...activity.storeViews,
    ],
    (item) => item.id,
    MAX_STORE_VIEWS
  )

  saveActivity({ ...activity, storeViews: nextViews })
  scheduleServerSync()
}

const categoryWeightsFromActivity = (activity: UserActivity) => {
  const weights = new Map<string, number>()

  activity.productQuickViews.slice(0, 30).forEach((item, index) => {
    const category = normalizeText(item.category)
    if (!category) return
    const recencyWeight = Math.max(2, 16 - index)
    weights.set(category, (weights.get(category) || 0) + recencyWeight)
  })

  activity.storeViews.slice(0, 30).forEach((item, index) => {
    const category = normalizeText(item.category)
    if (!category) return
    const recencyWeight = Math.max(2, 12 - index)
    weights.set(category, (weights.get(category) || 0) + recencyWeight)
  })

  return weights
}

const storeNameWeightsFromActivity = (activity: UserActivity) => {
  const weights = new Map<string, number>()

  activity.productQuickViews.slice(0, 40).forEach((item, index) => {
    const storeName = normalizeText(item.storeName)
    if (!storeName) return
    const recencyWeight = Math.max(2, 14 - index)
    weights.set(storeName, (weights.get(storeName) || 0) + recencyWeight)
  })

  activity.storeViews.slice(0, 40).forEach((item, index) => {
    const storeName = normalizeText(item.name)
    if (!storeName) return
    const recencyWeight = Math.max(2, 18 - index)
    weights.set(storeName, (weights.get(storeName) || 0) + recencyWeight)
  })

  return weights
}

const searchTokensFromActivity = (activity: UserActivity) => {
  const tokens: string[] = []
  activity.searches.slice(0, 30).forEach((entry) => {
    tokens.push(...tokenize(entry.query))
  })
  return Array.from(new Set(tokens)).slice(0, 40)
}

const recentProductIds = (activity: UserActivity) => new Set(activity.productQuickViews.slice(0, 20).map((x) => x.id))

const recentStoreIds = (activity: UserActivity) => new Set(activity.storeViews.slice(0, 20).map((x) => x.id))

const getLegacyRecentlyViewedCategories = () => {
  if (!canUseStorage()) return new Map<string, number>()

  try {
    const raw = localStorage.getItem("recentlyViewed")
    if (!raw) return new Map<string, number>()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Map<string, number>()

    const weights = new Map<string, number>()
    parsed.slice(0, 20).forEach((item: any, index: number) => {
      const category = normalizeText(item?.category)
      if (!category) return
      const recencyWeight = Math.max(1, 8 - index)
      weights.set(category, (weights.get(category) || 0) + recencyWeight)
    })

    return weights
  } catch {
    return new Map<string, number>()
  }
}

export const personalizeProducts = <T extends ProductLike>(products: T[]): T[] => {
  if (!products.length || !canUseStorage()) return products

  const activity = loadActivity()
  const categoryWeights = categoryWeightsFromActivity(activity)
  const legacyCategoryWeights = getLegacyRecentlyViewedCategories()
  const storeWeights = storeNameWeightsFromActivity(activity)
  const searchTokens = searchTokensFromActivity(activity)
  const quickViewedIds = recentProductIds(activity)

  const scored = products.map((product, index) => {
    const id = toId(product.id || product._id)
    const category = normalizeText(product.category)
    const storeName = normalizeText(product.storeName || product.vendorName)
    const haystack = normalizeText(
      `${product.title || product.name || ""} ${product.description || ""} ${category} ${storeName}`
    )

    let score = 0

    score += (categoryWeights.get(category) || 0) * 1.4
    score += (legacyCategoryWeights.get(category) || 0) * 0.9
    score += (storeWeights.get(storeName) || 0) * 1.6

    if (id && quickViewedIds.has(id)) {
      score += 30
    }

    searchTokens.forEach((token) => {
      if (haystack.includes(token)) score += 3
    })

    score += Math.min(Number(product.sales || 0), 200) * 0.04

    return { product, score, index }
  })

  const hasSignal = scored.some((item) => item.score > 0)
  if (!hasSignal) return products

  return scored
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.index - b.index
    })
    .map((item) => item.product)
}

export const personalizeStores = <T extends StoreLike>(stores: T[]): T[] => {
  if (!stores.length || !canUseStorage()) return stores

  const activity = loadActivity()
  const categoryWeights = categoryWeightsFromActivity(activity)
  const storeWeights = storeNameWeightsFromActivity(activity)
  const searchTokens = searchTokensFromActivity(activity)
  const viewedStoreIds = recentStoreIds(activity)

  const scored = stores.map((store, index) => {
    const id = toId(store.id || store._id)
    const category = normalizeText(store.category)
    const name = normalizeText(store.name || store.storeName)
    const location = normalizeText(store.location || store.city)
    const haystack = normalizeText(`${name} ${category} ${location}`)

    let score = 0

    score += (categoryWeights.get(category) || 0) * 1.5
    score += (storeWeights.get(name) || 0) * 2

    if (id && viewedStoreIds.has(id)) {
      score += 35
    }

    searchTokens.forEach((token) => {
      if (haystack.includes(token)) score += 3
    })

    score += Math.min(Number(store.productCount || 0), 300) * 0.05

    return { store, score, index }
  })

  const hasSignal = scored.some((item) => item.score > 0)
  if (!hasSignal) return stores

  return scored
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.index - b.index
    })
    .map((item) => item.store)
}
