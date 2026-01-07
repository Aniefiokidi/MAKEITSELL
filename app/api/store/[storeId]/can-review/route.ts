import { NextResponse } from "next/server"
import { getDbInstance } from "@/lib/firebase"
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore"

export async function GET(
  request: Request,
  { params }: { params: { storeId: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')
    const storeId = params.storeId

    if (!storeId || !customerId) {
      return NextResponse.json({ 
        success: false, 
        error: "storeId and customerId are required" 
      }, { status: 400 })
    }

    // Get store information
    const storeDoc = await getDoc(doc(getDbInstance(), "stores", storeId))
    if (!storeDoc.exists()) {
      return NextResponse.json({ 
        success: false, 
        error: "Store not found" 
      }, { status: 404 })
    }

    const storeData = storeDoc.data()

    // Check if customer has any delivered orders from this store
    const ordersQuery = query(
      collection(getDbInstance(), "orders"),
      where("customerId", "==", customerId),
      where("vendorId", "==", storeData.vendorId),
      where("status", "==", "delivered")
    )
    const ordersSnapshot = await getDocs(ordersQuery)
    
    if (ordersSnapshot.empty) {
      return NextResponse.json({
        success: true,
        canReview: false,
        reason: "No delivered orders from this store"
      })
    }

    // Check if any delivered order hasn't been reviewed yet
    let canReview = false
    let availableOrderId = null

    for (const orderDoc of ordersSnapshot.docs) {
      const existingReviewQuery = query(
        collection(getDbInstance(), "storeReviews"),
        where("orderId", "==", orderDoc.id),
        where("customerId", "==", customerId)
      )
      const existingReview = await getDocs(existingReviewQuery)
      
      if (existingReview.empty) {
        canReview = true
        availableOrderId = orderDoc.id
        break
      }
    }

    return NextResponse.json({
      success: true,
      canReview,
      availableOrderId,
      storeInfo: {
        id: storeId,
        name: storeData.storeName,
        vendorId: storeData.vendorId,
        rating: storeData.rating || 0,
        reviewCount: storeData.reviewCount || 0
      }
    })

  } catch (error) {
    console.error("Error checking review eligibility:", error)
    return NextResponse.json({ 
      success: false, 
      error: "Internal server error" 
    }, { status: 500 })
  }
}