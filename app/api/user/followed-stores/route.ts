import { NextRequest, NextResponse } from "next/server"
import connectToDatabase from "@/lib/mongodb"
import { Follow } from "@/lib/models/Follow"
// @ts-ignore
import { Store as StoreModel } from "@/lib/models/Store"
import { getSessionUserFromRequest } from "@/lib/server-route-auth"

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    await connectToDatabase()

    // Always the caller's own follows — this previously took userId straight from the
    // query string with no session check, letting anyone list any other user's followed
    // stores just by knowing/guessing their user id.
    const follows = await Follow.find({ customerId: sessionUser.id }).lean()

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
