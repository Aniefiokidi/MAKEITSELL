import { NextRequest, NextResponse } from "next/server"
import mongoose from "mongoose"
import connectToDatabase from "@/lib/mongodb"
import { Product } from "@/lib/models/Product"

// Lightweight batch endpoint: returns image + price for a list of product IDs.
// Used by the homepage to enrich stale recently-viewed localStorage entries.
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("ids") || ""
  const ids = raw.split(",").map(s => s.trim()).filter(Boolean).slice(0, 20)

  if (!ids.length) {
    return NextResponse.json({ success: true, products: [] })
  }

  const objectIds = ids
    .filter(id => mongoose.Types.ObjectId.isValid(id))
    .map(id => new mongoose.Types.ObjectId(id))

  if (!objectIds.length) {
    return NextResponse.json({ success: true, products: [] })
  }

  await connectToDatabase()

  const docs = await Product.find({ _id: { $in: objectIds } })
    .select("_id price images name title")
    .lean() as any[]

  const products = docs.map(doc => ({
    id: String(doc._id),
    price: Number(doc.price || 0),
    image: (Array.isArray(doc.images) && doc.images.find((img: any) => typeof img === "string" && img.trim())) || "",
    title: doc.title || doc.name || "",
  }))

  return NextResponse.json(
    { success: true, products },
    { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } }
  )
}
