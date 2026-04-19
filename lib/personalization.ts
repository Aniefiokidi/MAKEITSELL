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

type ActivityServiceView = {
  id: string
  title?: string
  category?: string
  providerName?: string
  location?: string
  ts: number
}

type UserActivity = {
  searches: ActivitySearch[]
  productQuickViews: ActivityProductQuickView[]
  storeViews: ActivityStoreView[]
  serviceViews: ActivityServiceView[]
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
  rating?: number
  reviewCount?: number
  featured?: boolean
  stock?: number
  status?: string
}

type StoreLike = {
  id?: string
  _id?: string
  name?: string
  storeName?: string
  logo?: string
  category?: string
  location?: string
  city?: string
  productCount?: number
  storeImage?: string
  logoImage?: string
  profileImage?: string
  profileCardImage?: string
  bannerImage?: string
  backgroundImage?: string
  productImages?: string[]
  featuredProduct?: { image?: string }
}

type ServiceLike = {
  id?: string
  _id?: string
  title?: string
  description?: string
  category?: string
  providerName?: string
  providerImage?: string
  profileImage?: string
  profileCardImage?: string
  state?: string
  city?: string
  location?: string
  packageOptions?: Array<{ price?: number; active?: boolean }>
  images?: string[]
  productCount?: number
  price?: number
  rating?: number
  reviewCount?: number
  featured?: boolean
  status?: string
}

const USER_ACTIVITY_KEY = "mis:user-activity:v1"
const MAX_SEARCH_EVENTS = 60
const MAX_PRODUCT_QUICK_VIEWS = 80
const MAX_STORE_VIEWS = 80
const MAX_SERVICE_VIEWS = 80
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
  serviceViews: [],
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
      serviceViews: Array.isArray(parsed?.serviceViews) ? parsed.serviceViews : [],
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
  serviceViews: uniqueRecent(
    [...(incoming.serviceViews || []), ...(base.serviceViews || [])],
    (item) => toId(item.id),
    MAX_SERVICE_VIEWS
  ),
})

const parseServerActivity = (payload: unknown): UserActivity | null => {
  const typed = payload as SyncServerResponse
  if (!typed?.success || !typed?.activity) return null

  return {
    searches: Array.isArray(typed.activity.searches) ? typed.activity.searches : [],
    productQuickViews: Array.isArray(typed.activity.productQuickViews) ? typed.activity.productQuickViews : [],
    storeViews: Array.isArray(typed.activity.storeViews) ? typed.activity.storeViews : [],
    serviceViews: Array.isArray((typed.activity as any).serviceViews) ? (typed.activity as any).serviceViews : [],
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

export const trackServiceView = (service: {
  id?: string
  _id?: string
  title?: string
  category?: string
  providerName?: string
  location?: string
  state?: string
  city?: string
}) => {
  const id = toId(service.id || service._id)
  if (!id) return

  const activity = loadActivity()
  const now = Date.now()

  const nextViews = uniqueRecent(
    [
      {
        id,
        title: service.title,
        category: normalizeText(service.category),
        providerName: normalizeText(service.providerName),
        location: normalizeText(service.location || service.city || service.state),
        ts: now,
      },
      ...(activity.serviceViews || []),
    ],
    (item) => item.id,
    MAX_SERVICE_VIEWS
  )

  saveActivity({ ...activity, serviceViews: nextViews })
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

  ;(activity.serviceViews || []).slice(0, 30).forEach((item, index) => {
    const category = normalizeText(item.category)
    if (!category) return
    const recencyWeight = Math.max(2, 14 - index)
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

  ;(activity.serviceViews || []).slice(0, 40).forEach((item, index) => {
    const providerName = normalizeText(item.providerName)
    if (!providerName) return
    const recencyWeight = Math.max(2, 16 - index)
    weights.set(providerName, (weights.get(providerName) || 0) + recencyWeight)
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

const locationWeightsFromActivity = (activity: UserActivity) => {
  const weights = new Map<string, number>()

  ;(activity.serviceViews || []).slice(0, 30).forEach((item, index) => {
    const location = normalizeText(item.location)
    if (!location) return
    const recencyWeight = Math.max(2, 14 - index)
    weights.set(location, (weights.get(location) || 0) + recencyWeight)
  })

  activity.storeViews.slice(0, 30).forEach((item, index) => {
    const location = normalizeText(item.location)
    if (!location) return
    const recencyWeight = Math.max(2, 12 - index)
    weights.set(location, (weights.get(location) || 0) + recencyWeight)
  })

  return weights
}

const recentProductIds = (activity: UserActivity) => new Set(activity.productQuickViews.slice(0, 20).map((x) => x.id))

const recentStoreIds = (activity: UserActivity) => new Set(activity.storeViews.slice(0, 20).map((x) => x.id))

const recentServiceIds = (activity: UserActivity) => new Set((activity.serviceViews || []).slice(0, 20).map((x) => x.id))

const hasNonEmptyString = (value: unknown) => typeof value === "string" && value.trim().length > 0

const isMeaningfulImageValue = (value: unknown) => {
  if (typeof value !== "string") return false
  const normalized = value.trim().toLowerCase()
  if (!normalized) return false
  if (/placeholder|default|no[-_ ]?image/.test(normalized)) return false
  return true
}

const storeCompletenessTier = (store: StoreLike) => {
  const hasLogo =
    isMeaningfulImageValue(store.storeImage) ||
    isMeaningfulImageValue(store.logoImage) ||
    isMeaningfulImageValue(store.logo)

  const hasProfileCardImage =
    isMeaningfulImageValue(store.profileImage) ||
    isMeaningfulImageValue(store.profileCardImage) ||
    isMeaningfulImageValue(store.bannerImage) ||
    isMeaningfulImageValue(store.backgroundImage)

  const hasProductsPosted =
    Number(store.productCount || 0) > 0 ||
    (Array.isArray(store.productImages) && store.productImages.some((img) => hasNonEmptyString(img))) ||
    hasNonEmptyString(store.featuredProduct?.image)

  const hasStoreCardImage = hasLogo || hasProfileCardImage

  if (hasProductsPosted && hasStoreCardImage) return 4
  if (hasStoreCardImage) return 3
  if (hasProductsPosted) return 2
  return 1
}

const serviceCompletenessTier = (service: ServiceLike) => {
  const hasLogo = hasNonEmptyString(service.providerImage)

  const hasProfileCardImage =
    hasNonEmptyString(service.profileImage) ||
    hasNonEmptyString(service.profileCardImage) ||
    (Array.isArray(service.images) && service.images.some((img) => hasNonEmptyString(img)))

  const hasProductsPosted =
    Number(service.productCount || 0) > 0 ||
    (Array.isArray(service.packageOptions) && service.packageOptions.some((pkg) => pkg && Number(pkg.price || 0) > 0))

  if (hasProductsPosted && hasLogo && hasProfileCardImage) return 3
  if (hasProductsPosted || hasLogo || hasProfileCardImage) return 2
  return 1
}

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
    score += Math.max(0, Math.min(Number(product.rating || 0), 5)) * 1.5
    score += Math.min(Number(product.reviewCount || 0), 150) * 0.05
    if (product.featured) score += 3
    if (Number(product.stock || 0) > 0) score += 2
    if (normalizeText(product.status) === "active") score += 1

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

    return { store, score, completenessTier: storeCompletenessTier(store), index }
  })

  const hasSignal = scored.some((item) => item.score > 0)
  const hasCompletenessSignal = scored.some((item) => item.completenessTier !== 2)
  if (!hasSignal && !hasCompletenessSignal) return stores

  return scored
    .sort((a, b) => {
      if (b.completenessTier !== a.completenessTier) return b.completenessTier - a.completenessTier
      if (b.score !== a.score) return b.score - a.score
      return a.index - b.index
    })
    .map((item) => item.store)
}

export const personalizeServices = <T extends ServiceLike>(services: T[]): T[] => {
  if (!services.length || !canUseStorage()) return services

  const activity = loadActivity()
  const categoryWeights = categoryWeightsFromActivity(activity)
  const providerWeights = storeNameWeightsFromActivity(activity)
  const searchTokens = searchTokensFromActivity(activity)
  const viewedServiceIds = recentServiceIds(activity)
  const locationWeights = locationWeightsFromActivity(activity)

  const scored = services.map((service, index) => {
    const id = toId(service.id || service._id)
    const category = normalizeText(service.category)
    const providerName = normalizeText(service.providerName)
    const location = normalizeText(service.location || service.city || service.state)
    const haystack = normalizeText(`${service.title || ""} ${service.description || ""} ${category} ${providerName} ${location}`)

    const packagePrices = Array.isArray(service.packageOptions)
      ? service.packageOptions
          .filter((pkg) => pkg && pkg.active !== false)
          .map((pkg) => Number(pkg.price || 0))
          .filter((price) => Number.isFinite(price) && price > 0)
      : []
    const basePrice = packagePrices.length > 0 ? Math.min(...packagePrices) : Number(service.price || 0)

    let score = 0

    score += (categoryWeights.get(category) || 0) * 1.6
    score += (providerWeights.get(providerName) || 0) * 1.4
    score += (locationWeights.get(location) || 0) * 1.3

    if (id && viewedServiceIds.has(id)) {
      score += 40
    }

    searchTokens.forEach((token) => {
      if (haystack.includes(token)) score += 3
    })

    if (Number.isFinite(basePrice) && basePrice > 0) {
      score += Math.max(0, 20 - Math.min(basePrice / 5000, 20))
    }

    score += Math.max(0, Math.min(Number(service.rating || 0), 5)) * 2
    score += Math.min(Number(service.reviewCount || 0), 200) * 0.06
    if (service.featured) score += 4
    if (normalizeText(service.status) === "active") score += 2

    return { service, score, completenessTier: serviceCompletenessTier(service), index }
  })

  const hasSignal = scored.some((item) => item.score > 0)
  const hasCompletenessSignal = scored.some((item) => item.completenessTier !== 2)
  if (!hasSignal && !hasCompletenessSignal) return services

  return scored
    .sort((a, b) => {
      if (b.completenessTier !== a.completenessTier) return b.completenessTier - a.completenessTier
      if (b.score !== a.score) return b.score - a.score
      return a.index - b.index
    })
    .map((item) => item.service)
}
