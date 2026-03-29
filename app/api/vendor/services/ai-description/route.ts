import { NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

function buildFallbackDescription(input: {
  title: string
  category?: string
  locationType?: string
  packageNames?: string[]
  tags?: string
}): string {
  const packages = (input.packageNames || []).filter(Boolean)
  const packageLine = packages.length > 0
    ? `Packages available: ${packages.join(", ")}.`
    : "Flexible package options available on request."
  const tags = String(input.tags || "").trim()

  return `${input.title} is a professional ${input.category || "service"} offering delivered via ${input.locationType || "a flexible format"}. ${packageLine} ${tags ? `Focus areas include: ${tags}.` : "Designed for quality, clarity, and reliable delivery."} Reach out with your goals to get a tailored experience.`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const title = String(body?.title || "").trim()
    const category = String(body?.category || "").trim()
    const locationType = String(body?.locationType || "").trim()
    const tags = String(body?.tags || "").trim()
    const packageNames = Array.isArray(body?.packageNames)
      ? body.packageNames.map((item: any) => String(item || "").trim()).filter(Boolean)
      : []

    if (!title) {
      return NextResponse.json({ success: false, error: "title is required" }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey || apiKey.length < 10) {
      return NextResponse.json({
        success: true,
        data: {
          description: buildFallbackDescription({ title, category, locationType, packageNames, tags }),
          source: "fallback",
        },
      })
    }

    const ai = new GoogleGenerativeAI(apiKey)
    const model = ai.getGenerativeModel({ model: "gemini-pro" })

    const prompt = `You write concise marketplace service descriptions.

Return only the final description text in 2 short paragraphs.
Tone: confident, clear, non-hype.
Do not include markdown or bullet points.

Service title: ${title}
Category: ${category || "General"}
Location type: ${locationType || "Flexible"}
Packages: ${packageNames.join(", ") || "None provided"}
Tags: ${tags || "None"}`

    const result = await model.generateContent(prompt)
    const generated = result.response.text().trim()
    const description = generated || buildFallbackDescription({ title, category, locationType, packageNames, tags })

    return NextResponse.json({
      success: true,
      data: {
        description,
        source: generated ? "gemini" : "fallback",
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: true,
        data: {
          description: buildFallbackDescription({ title: "Your service" }),
          source: "fallback",
        },
      },
      { status: 200 }
    )
  }
}
