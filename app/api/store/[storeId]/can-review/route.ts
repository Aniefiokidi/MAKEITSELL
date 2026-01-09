import { NextResponse } from "next/server"
// TODO: Replace Firestore logic with MongoDB

export async function GET(
  request: Request,
  { params }: { params: Promise<{ storeId: string }> }
) {
  try {
    const { storeId } = await params
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')

    if (!storeId || !customerId) {
      return NextResponse.json({ 
        success: false, 
        error: "storeId and customerId are required" 
      }, { status: 400 })
    }

    // TODO: Get store info and check delivered orders in MongoDB
    // Stub response:
    return NextResponse.json({ success: true, canReview: true, message: "Stub: can review" })
    
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