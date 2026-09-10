import { NextRequest, NextResponse } from "next/server"
import sharp from "sharp"
import { SchemaType, type ResponseSchema } from "@google/generative-ai"
import { GEMINI_FAST_MODEL, getGeminiModel } from "@/lib/gemini-client"
import { requireRoles } from "@/lib/server-route-auth"
import { connectToDatabase } from "@/lib/mongodb"
import { Product } from "@/lib/models/Product"
import { CATEGORIES, FASHION_SUBCATEGORIES, ELECTRONICS_SUBCATEGORIES } from "@/lib/vendor-product-taxonomy"

const MAX_IMAGES = 3
// Gemini reads a product just as well at this size, and a 12MP phone photo costs real
// seconds shipping pixels it doesn't need — the first live test spent ~20s end-to-end,
// most of it uploading originals.
const MAX_IMAGE_EDGE = 1024
// The sentinel the model returns for categories that have no subcategory list, instead
// of an empty string — a constrained vocabulary the schema can actually enforce.
const NO_SUBCATEGORY = "none"

interface ImagePart {
  mimeType: string
  data: string
}

// Every image, whatever it arrived as, goes through here: re-oriented, downscaled and
// re-encoded to one predictable format before the model sees it.
async function toImagePart(buffer: Buffer): Promise<ImagePart | null> {
  try {
    const normalized = await sharp(buffer)
      // No args = apply the EXIF orientation flag. A photo shot sideways otherwise
      // reaches the model rotated, which is exactly what turns a wristwatch into a
      // bracelet.
      .rotate()
      .resize(MAX_IMAGE_EDGE, MAX_IMAGE_EDGE, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer()
    return { mimeType: "image/jpeg", data: normalized.toString("base64") }
  } catch {
    return null
  }
}

function decodeBase64Image(base64: string): Buffer | null {
  try {
    const match = /^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/.exec(base64)
    return Buffer.from(match ? match[1] : base64, "base64")
  } catch {
    return null
  }
}

async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

function subcategoryListFor(category: string): string[] {
  if (category === "Fashion") return FASHION_SUBCATEGORIES
  if (category === "Electronics") return ELECTRONICS_SUBCATEGORIES
  return []
}

// Case-insensitive match back to the taxonomy's real casing. The schema below already
// constrains the model to these exact values, so this is now belt-and-braces rather
// than the only line of defence.
function resolveTaxonomyValue(value: unknown, options: string[]): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  const found = options.find((option) => option.toLowerCase() === value.trim().toLowerCase())
  return found || null
}

// The model is told two sentences and 30 words, and mostly obeys — but a listing that
// quietly runs to a paragraph is the exact failure this feature was asked to design
// out, so the ceiling is enforced here rather than trusted to the prompt.
function tightenDescription(raw: unknown): string {
  if (typeof raw !== "string") return ""
  const text = raw.replace(/\s+/g, " ").trim()
  if (!text) return ""
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text]
  // Re-collapse whitespace after joining: the sentence matches keep their trailing
  // space, so a naive join leaves a double space at every seam.
  return sentences.slice(0, 2).join(" ").replace(/\s+/g, " ").trim()
}

function percentile(sortedValues: number[], p: number): number {
  const index = (sortedValues.length - 1) * p
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sortedValues[lower]
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (index - lower)
}

async function pricesForQuery(
  query: Record<string, unknown>,
  byTextScore: boolean
): Promise<number[]> {
  let cursor = Product.find(query).select("price").limit(byTextScore ? 40 : 200)
  if (byTextScore) cursor = cursor.sort({ score: { $meta: "textScore" } })
  const docs = await cursor.lean()
  return (docs as any[])
    .map((doc) => Number(doc.price))
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b)
}

async function buildPriceHint(
  draftName: string,
  category: string,
  subcategory: string | null
): Promise<string | null> {
  let prices: number[] = []

  // First choice: products whose titles actually match this one. The Product text index
  // weights `name` heavily, so a search for "Black over-ear wireless headphones" surfaces
  // other headphones — where a plain `{ category: "Electronics" }` query would price this
  // against every phone case and laptop in the store (the first live run of that produced
  // "₦6,000–₦515,000", which tells a vendor nothing).
  if (draftName.trim().length >= 3) {
    prices = await pricesForQuery(
      { $text: { $search: draftName }, status: "active" },
      true
    ).catch(() => [])
  }

  // Fall back to category (plus subcategory where the taxonomy has one) only when the
  // title search came back too thin to lean on.
  if (prices.length < 3) {
    const catQuery: Record<string, unknown> = { status: "active", category }
    if (subcategory) catQuery.subcategory = subcategory
    prices = await pricesForQuery(catQuery, false).catch(() => [])
  }

  if (prices.length < 3) return null

  const low = Math.round(percentile(prices, 0.25))
  const high = Math.round(percentile(prices, 0.75))

  // Last-ditch sanity check: even matched titles can be a grab bag. If the middle half
  // of comparables still spans more than 4x, they aren't comparable enough to quote —
  // a bad number here quietly costs the vendor's trust in every number we show.
  if (low <= 0 || high / low > 4) return null

  const formatted = (value: number) => `₦${value.toLocaleString("en-NG")}`
  return `${formatted(low)}–${formatted(high)} based on ${prices.length} similar listings`
}

// Structured output: the model is handed the shape it must return, so category can't
// come back as a value the vendor's dropdown has never heard of, and the response is
// guaranteed parseable JSON rather than JSON-wrapped-in-markdown on a bad day.
const RESPONSE_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    name: { type: SchemaType.STRING },
    description: { type: SchemaType.STRING },
    category: { type: SchemaType.STRING, format: "enum", enum: [...CATEGORIES] },
    subcategory: {
      type: SchemaType.STRING,
      format: "enum",
      enum: [NO_SUBCATEGORY, ...FASHION_SUBCATEGORIES, ...ELECTRONICS_SUBCATEGORIES],
    },
    tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ["name", "description", "category", "subcategory", "tags"],
}

const SYSTEM_INSTRUCTION = `You write product listings for Make It Sell, a Nigerian online marketplace. Shoppers browse on their phones and decide in seconds, so your copy is short, plain and concrete — closer to a price tag than a catalogue entry.

Rules you always follow:
- Describe the item being sold. Never the background, the surface it rests on, the lighting, or the photograph itself.
- Never explain what a common object is. Someone looking at a blender already knows what a blender does.
- No filler openings ("Perfect for...", "Introducing...", "Elevate your..."), no stacked adjectives, no sales pitch.
- State a detail only when it is clearly visible. If the brand, size or material isn't legible, leave it out rather than guess.`

export async function POST(request: NextRequest) {
  const { response } = await requireRoles(request, ["vendor", "admin"])
  if (response) return response

  try {
    const body = await request.json()
    const imageUrls: string[] = Array.isArray(body?.imageUrls) ? body.imageUrls.filter((u: unknown) => typeof u === "string") : []
    const imageBase64: string[] = Array.isArray(body?.imageBase64) ? body.imageBase64.filter((b: unknown) => typeof b === "string") : []

    if (imageUrls.length === 0 && imageBase64.length === 0) {
      return NextResponse.json({ success: false, error: "At least one image is required" }, { status: 400 })
    }

    const model = getGeminiModel(GEMINI_FAST_MODEL, {
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        // Low, not zero: this is a description, not a lookup, but it should read the
        // same way twice for the same photo.
        temperature: 0.3,
        // Deliberately generous, and NOT a length control. On a thinking model this
        // budget covers internal reasoning tokens before a single character of answer
        // is emitted — at 400 the first version of this route spent 380 on thought and
        // truncated the JSON mid-string. Description length is held by the prompt and
        // by tightenDescription() below, which is where it belongs.
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    })
    if (!model) {
      return NextResponse.json({ success: false, error: "AI drafting is unavailable" })
    }

    const localBuffers = imageBase64.slice(0, MAX_IMAGES).map(decodeBase64Image)
    const remainingSlots = MAX_IMAGES - localBuffers.length
    const fetchedBuffers = remainingSlots > 0
      ? await Promise.all(imageUrls.slice(0, remainingSlots).map(fetchImage))
      : []

    const imageParts = (
      await Promise.all(
        [...localBuffers, ...fetchedBuffers]
          .filter((buffer): buffer is Buffer => !!buffer)
          .map(toImagePart)
      )
    ).filter((part): part is ImagePart => !!part)

    if (imageParts.length === 0) {
      return NextResponse.json({ success: false, error: "Could not read the provided images" })
    }

    const prompt = `Draft the listing for the item in these photos.

name — the title a shopper would recognise and type into search. Include the brand and model if they are legible in the photo. Max 10 words.
description — 1 to 2 sentences, 30 words maximum in total. What the item is, then the one or two details a buyer actually needs (size, material, condition, quantity, what it does). Do not restate the title.
category — the closest fit, even if imperfect.
subcategory — for Fashion, one of: ${FASHION_SUBCATEGORIES.join(", ")}. For Electronics, one of: ${ELECTRONICS_SUBCATEGORIES.join(", ")}. For every other category: ${NO_SUBCATEGORY}.
tags — 3 to 6 lowercase keywords a shopper might search.`

    const result = await model.generateContent([prompt, ...imageParts.map((part) => ({ inlineData: part }))])
    const rawText = result.response.text().trim()
    // responseMimeType guarantees raw JSON, so this only ever matters if a future model
    // version regresses to fencing its output.
    const cleanedText = rawText.replace(/```json\s*|```/g, "").trim()

    let parsed: any
    try {
      parsed = JSON.parse(cleanedText)
    } catch {
      return NextResponse.json({ success: false, error: "Could not parse AI response" })
    }

    const draftName = typeof parsed?.name === "string" ? parsed.name.trim().slice(0, 120) : ""
    const category = resolveTaxonomyValue(parsed?.category, CATEGORIES)
    const subcategory = category ? resolveTaxonomyValue(parsed?.subcategory, subcategoryListFor(category)) : null
    const tags = Array.isArray(parsed?.tags)
      ? parsed.tags.map((tag: unknown) => String(tag || "").trim()).filter(Boolean).slice(0, 6)
      : []

    let priceHint: string | null = null
    if (category) {
      await connectToDatabase()
      priceHint = await buildPriceHint(draftName, category, subcategory).catch(() => null)
    }

    return NextResponse.json({
      success: true,
      data: {
        name: draftName,
        description: tightenDescription(parsed?.description),
        category,
        subcategory,
        tags,
        priceHint,
      },
    })
  } catch (error) {
    console.error("AI product draft error:", error)
    return NextResponse.json({ success: false, error: "Failed to generate draft" })
  }
}
