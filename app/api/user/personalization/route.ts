import { NextRequest, NextResponse } from "next/server"
import mongoose from "mongoose"
import connectToDatabase from "@/lib/mongodb"
import { getSessionUserFromRequest } from "@/lib/server-route-auth"

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

const MAX_SEARCH_EVENTS = 60
const MAX_PRODUCT_QUICK_VIEWS = 80
const MAX_STORE_VIEWS = 80

const normalizeText = (value: unknown) => String(value || "").toLowerCase().trim()
const toId = (value: unknown) => String(value || "").trim()

const defaultActivity = (): UserActivity => ({
  searches: [],
  productQuickViews: [],
  storeViews: [],
})

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

const sanitizeActivity = (value: any): UserActivity => {
  const base = defaultActivity()
  const parsed = value && typeof value === "object" ? value : base

  const searchesRaw = Array.isArray(parsed.searches) ? parsed.searches : []
  const productViewsRaw = Array.isArray(parsed.productQuickViews) ? parsed.productQuickViews : []
  const storeViewsRaw = Array.isArray(parsed.storeViews) ? parsed.storeViews : []

  const searches = uniqueRecent(
    searchesRaw
      .map((entry: any) => ({
        query: normalizeText(entry?.query),
        scope: ["products", "stores", "services", "site"].includes(entry?.scope) ? entry.scope : "site",
        ts: Number(entry?.ts) || Date.now(),
      }))
      .filter((entry: ActivitySearch) => entry.query.length >= 2),
    (entry) => `${entry.scope}:${entry.query}`,
    MAX_SEARCH_EVENTS
  )

  const productQuickViews = uniqueRecent(
    productViewsRaw
      .map((entry: any) => ({
        id: toId(entry?.id),
        category: normalizeText(entry?.category),
        title: String(entry?.title || "").trim(),
        storeName: normalizeText(entry?.storeName),
        ts: Number(entry?.ts) || Date.now(),
      }))
      .filter((entry: ActivityProductQuickView) => !!entry.id),
    (entry) => entry.id,
    MAX_PRODUCT_QUICK_VIEWS
  )

  const storeViews = uniqueRecent(
    storeViewsRaw
      .map((entry: any) => ({
        id: toId(entry?.id),
        name: String(entry?.name || "").trim(),
        category: normalizeText(entry?.category),
        location: normalizeText(entry?.location),
        ts: Number(entry?.ts) || Date.now(),
      }))
      .filter((entry: ActivityStoreView) => !!entry.id),
    (entry) => entry.id,
    MAX_STORE_VIEWS
  )

  return { searches, productQuickViews, storeViews }
}

const mergeActivities = (current: UserActivity, incoming: UserActivity): UserActivity => {
  return {
    searches: uniqueRecent(
      [...incoming.searches, ...current.searches],
      (entry) => `${entry.scope}:${entry.query}`,
      MAX_SEARCH_EVENTS
    ),
    productQuickViews: uniqueRecent(
      [...incoming.productQuickViews, ...current.productQuickViews],
      (entry) => entry.id,
      MAX_PRODUCT_QUICK_VIEWS
    ),
    storeViews: uniqueRecent(
      [...incoming.storeViews, ...current.storeViews],
      (entry) => entry.id,
      MAX_STORE_VIEWS
    ),
  }
}

const buildUserSelector = (userId: string) => {
  const selectors: Record<string, any>[] = [{ _id: userId }, { id: userId }]
  if (mongoose.Types.ObjectId.isValid(userId)) {
    selectors.push({ _id: new mongoose.Types.ObjectId(userId) })
  }
  return { $or: selectors }
}

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    await connectToDatabase()
    const db = mongoose.connection.db
    const selector = buildUserSelector(sessionUser.id)

    const user = await db.collection("users").findOne(selector, {
      projection: { personalizationActivity: 1 },
    })

    const activity = sanitizeActivity(user?.personalizationActivity)

    return NextResponse.json({ success: true, activity })
  } catch (error) {
    console.error("[personalization GET]", error)
    return NextResponse.json({ success: false, error: "Failed to load personalization activity" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const incoming = sanitizeActivity(body?.activity)

    await connectToDatabase()
    const db = mongoose.connection.db
    const selector = buildUserSelector(sessionUser.id)

    const existing = await db.collection("users").findOne(selector, {
      projection: { personalizationActivity: 1 },
    })

    const merged = mergeActivities(sanitizeActivity(existing?.personalizationActivity), incoming)

    const updateResult = await db.collection("users").updateOne(
      selector,
      {
        $set: {
          personalizationActivity: merged,
          updatedAt: new Date(),
        },
      }
    )

    if (!updateResult.matchedCount) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, activity: merged })
  } catch (error) {
    console.error("[personalization PUT]", error)
    return NextResponse.json({ success: false, error: "Failed to save personalization activity" }, { status: 500 })
  }
}
