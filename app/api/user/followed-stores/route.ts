import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/mongodb"
import { Follow } from "@/lib/models/Follow"
// @ts-ignore
import { Store as StoreModel } from "@/lib/models/Store"

export async function GET(request: Request) {
  try {
    await connectToDatabase()

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing userId",
        },
        { status: 400 }
      )
    }

    // Get all follows for this user
    const follows = await Follow.find({ customerId: userId }).lean()

    if (!follows || follows.length === 0) {
      return NextResponse.json(
        {
          success: true,
          data: [],
        },
        { status: 200 }
      )
    }

    // Get store details for each follow
    const storeIds = follows.map((f: any) => f.storeId)
    const stores = await StoreModel.find({ _id: { $in: storeIds } }).lean()

    // Map stores with follow data
    const followedStores = stores.map((store: any) => ({
      _id: store._id.toString(),
      storeId: store._id.toString(),
      storeName: store.storeName,
      storeImage: store.storeImage,
      storeDescription: store.storeDescription,
      category: store.category,
    }))

    return NextResponse.json(
      {
        success: true,
        data: followedStores,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching followed stores:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
