import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/mongodb"
import { Follow } from "@/lib/models/Follow"

// POST - Follow or unfollow a store
export async function POST(request: Request) {
  try {
    await connectToDatabase()

    const body = await request.json()
    const { storeId, vendorId, customerId, customerName, action } = body

    // Validate required fields
    if (!storeId || !vendorId || !customerId || !action) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields",
        },
        { status: 400 }
      )
    }

    if (action !== "follow" && action !== "unfollow") {
      return NextResponse.json(
        {
          success: false,
          error: "Action must be 'follow' or 'unfollow'",
        },
        { status: 400 }
      )
    }

    if (action === "follow") {
      // Check if already following
      const existingFollow = await Follow.findOne({ customerId, storeId })

      if (existingFollow) {
        return NextResponse.json(
          {
            success: true,
            isFollowing: true,
            message: "Already following this store",
          },
          { status: 200 }
        )
      }

      // Create follow record
      await Follow.create({
        customerId,
        storeId,
        vendorId,
        customerName,
      })

      return NextResponse.json(
        {
          success: true,
          isFollowing: true,
          message: "Successfully followed store",
        },
        { status: 201 }
      )
    } else {
      // Unfollow
      const result = await Follow.deleteOne({ customerId, storeId })

      return NextResponse.json(
        {
          success: true,
          isFollowing: false,
          message: "Successfully unfollowed store",
          deletedCount: result.deletedCount,
        },
        { status: 200 }
      )
    }
  } catch (error) {
    console.error("Error following/unfollowing store:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}

// GET - Check if user is following a store
export async function GET(request: Request) {
  try {
    await connectToDatabase()

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get("storeId")
    const customerId = searchParams.get("customerId")

    if (!storeId || !customerId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing storeId or customerId",
        },
        { status: 400 }
      )
    }

    const follow = await Follow.findOne({ customerId, storeId })

    return NextResponse.json(
      {
        success: true,
        isFollowing: !!follow,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error checking follow status:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}