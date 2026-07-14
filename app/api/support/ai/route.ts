import { NextRequest, NextResponse } from "next/server"
import { matchFaq } from "@/lib/support-faq"
import { personalize } from "@/lib/support-personalize"
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

    if (match.entry) {
      match.response.response = await personalize(match.entry.id, match.response.response, match.lang, context.userId)
    }

    await logQuery({
      query,
      normalizedQuery: match.normalizedQuery,
      lang: match.lang,
      matchedEntryId: match.matchedEntryId,
      userId: context.userId,
    })

    return NextResponse.json(match.response)
  } catch (error: any) {
    console.error("Support FAQ error:", error?.message ?? String(error))
    return NextResponse.json(matchFaq(query || "", context).response)
  }
}
