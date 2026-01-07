import { NextResponse } from "next/server"
import { getDbInstance } from "@/lib/firebase"
import { collection, doc, setDoc, deleteDoc, getDoc, Timestamp } from "firebase/firestore"

// POST - Follow or unfollow a store
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { storeId, vendorId, customerId, customerName, action } = body

    // Validate required fields
    if (!storeId || !vendorId || !customerId || !action) {
      return NextResponse.json({ 
        success: false, 
        error: "Missing required fields" 
      }, { status: 400 })
    }

    if (action !== 'follow' && action !== 'unfollow') {
      return NextResponse.json({ 
        success: false, 
        error: "Action must be 'follow' or 'unfollow'" 
      }, { status: 400 })
    }

    // Check if store exists
    const storeDoc = await getDoc(doc(getDbInstance(), "stores", storeId))
    if (!storeDoc.exists()) {
      return NextResponse.json({ 
        success: false, 
        error: "Store not found" 
      }, { status: 404 })
    }

    const followId = `${customerId}_${storeId}`

    if (action === 'follow') {
      // Create follow relationship
      await setDoc(doc(getDbInstance(), "storeFollows", followId), {
        storeId,
        vendorId,
        customerId,
        customerName: customerName || "Anonymous",
        followedAt: Timestamp.now()
      })

      return NextResponse.json({
        success: true,
        message: "Store followed successfully",
        isFollowing: true
      })

    } else { // unfollow
      // Remove follow relationship
      await deleteDoc(doc(getDbInstance(), "storeFollows", followId))

      return NextResponse.json({
        success: true,
        message: "Store unfollowed successfully",
        isFollowing: false
      })
    }

  } catch (error) {
    console.error("Error following/unfollowing store:", error)
    return NextResponse.json({ 
      success: false, 
      error: "Internal server error" 
    }, { status: 500 })
  }
}

// GET - Check if user is following a store
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    const customerId = searchParams.get('customerId')

    if (!storeId || !customerId) {
      return NextResponse.json({ 
        success: false, 
        error: "storeId and customerId are required" 
      }, { status: 400 })
    }

    const followId = `${customerId}_${storeId}`
    const followDoc = await getDoc(doc(getDbInstance(), "storeFollows", followId))

    return NextResponse.json({
      success: true,
      isFollowing: followDoc.exists()
    })

  } catch (error) {
    console.error("Error checking follow status:", error)
    return NextResponse.json({ 
      success: false, 
      error: "Internal server error" 
    }, { status: 500 })
  }
}