import { NextRequest, NextResponse } from "next/server"
import { matchFaq } from "@/lib/support-faq"
import { personalize } from "@/lib/support-personalize"
import { buildDiscoveryReply } from "@/lib/support-discovery"
import connectToDatabase from "@/lib/mongodb"
import { SupportQueryLog } from "@/lib/models/SupportQueryLog"

async function logQuery(params: { query: string; normalizedQuery: string; lang: string; matchedEntryId: string | null; userId?: string }) {
  try {
    await connectToDatabase()
    await SupportQueryLog.create(params)
  } catch (error: any) {
    // Logging must never break the actual chat response.
    console.error("Support query log error:", error?.message ?? String(error))
  }
}

export async function POST(request: NextRequest) {
  let query = ""
  let context: Record<string, any> = {}

  try {
    const body = await request.json()
    query = body.query ?? ""
    context = body.context ?? {}

    if (!query) {
      return NextResponse.json({ error: "query required" }, { status: 400 })
    }

    const match = matchFaq(query, context)
    let responsePayload = match.response

    // The matcher only had a generic "go browse" answer, or nothing at all — before
    // giving up, try a live lookup so a query naming an actual product/service can
    // surface real matching stores/providers instead. Never let a lookup failure
    // break the chat; just keep the FAQ-provided response.
    if (match.matchedEntryId === 'product-discovery' || match.matchedEntryId === null) {
      // Whether the query actually signaled shopping/booking intent, vs. being an
      // unrelated or gibberish message — used to decide whether a zero-result lookup
      // is worth a specific "couldn't find X" reply or should fall back to the
      // generic capability menu.
      const hasIntentSignal =
        match.matchedEntryId === 'product-discovery' ||
        /\b(want|need|looking|buy|purchase|find|service|book)\b/.test(match.normalizedQuery)

      try {
        const discoveryReply = await buildDiscoveryReply(query, match.lang, context.userName, hasIntentSignal)
        if (discoveryReply) {
          responsePayload = discoveryReply
        }
      } catch (error: any) {
        console.error("Support discovery lookup error:", error?.message ?? String(error))
      }
    }

    if (match.entry && responsePayload === match.response) {
      responsePayload.response = await personalize(match.entry.id, responsePayload.response, match.lang, context.userId)
    }

    await logQuery({
      query,
      normalizedQuery: match.normalizedQuery,
      lang: match.lang,
      matchedEntryId: match.matchedEntryId,
      userId: context.userId,
    })

    return NextResponse.json(responsePayload)
  } catch (error: any) {
    console.error("Support FAQ error:", error?.message ?? String(error))
    return NextResponse.json(matchFaq(query || "", context).response)
  }
}
