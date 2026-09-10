import { GoogleGenerativeAI, type GenerativeModel, type ModelParams } from "@google/generative-ai"

let client: GoogleGenerativeAI | null = null

// Flash, not Pro — Pro models came off Google's free tier in 2026, and Flash is what
// this app's AI features are built to run on for $0. Confirmed live against the real API
// key on 2026-09-09: gemini-2.5-flash (this project's original choice) now 404s with
// "no longer available to new users" — Google's own error pointed at this replacement.
// Re-verify against https://ai.google.dev/pricing before ever bumping this again; Google
// retires Flash generations off the free tier faster than this comment can track.
export const GEMINI_MODEL = "gemini-3.6-flash"

// For latency-sensitive work sitting behind a button someone is waiting on — notably
// photo-to-listing drafting. Flash-Lite does no extended thinking, which took that call
// from ~40s to ~2s, and on a five-category bake-off it was not just faster but slightly
// more accurate: it described the food in a food photo where the larger model described
// the bowls it was served in. Also free-tier for text *and* image input (verified
// 2026-09-10), same key, no billing to enable.
export const GEMINI_FAST_MODEL = "gemini-3.1-flash-lite"

// Returns null (never throws) when no key is configured — every caller already needs a
// "AI unavailable, fall back" path, since a missing/invalid key is an expected, not
// exceptional, state on the free tier.
//
// `params` carries the per-caller half of the model config (systemInstruction,
// generationConfig, and in particular responseSchema for callers that need structured
// output) — everything except the model name and the key handling, which is what this
// helper exists to own.
export function getGeminiModel(
  modelName: string = GEMINI_MODEL,
  params: Omit<ModelParams, "model"> = {}
): GenerativeModel | null {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey.length < 10) return null
  if (!client) client = new GoogleGenerativeAI(apiKey)
  return client.getGenerativeModel({ model: modelName, ...params })
}
