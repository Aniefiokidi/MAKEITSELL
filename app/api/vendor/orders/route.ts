import { NextRequest } from "next/server";
import { getOrdersByVendor } from "@/lib/mongodb-operations";
import connectToDatabase from "@/lib/mongodb";
import mongoose from "mongoose";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get("vendorId");
    if (!vendorId) {
      return new Response(JSON.stringify({ success: false, error: "Missing vendorId" }), { status: 400 });
    }
    const orders = await getOrdersByVendor(vendorId);
    
    // Enrich orders with product details
    await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (db) {
      for (const order of orders) {
        // Find vendor-specific items from vendors array
        const vendorData = order.vendors?.find((v: any) => v.vendorId === vendorId);
        const items = vendorData?.items || order.items || [];
        
        // Fetch product details for each item
        const enrichedProducts = await Promise.all(
          items.map(async (item: any) => {
            try {
              const productId = new mongoose.Types.ObjectId(item.productId);
              const product = await db.collection('products').findOne({ _id: productId });
              
              return {
                ...item,
                title: item.name || product?.name || 'Unknown Product',
                image: item.image || product?.images?.[0] || '',
                price: item.price || product?.price || 0
              };
            } catch (err) {
              return {
                ...item,
                title: item.name || 'Unknown Product',
                image: item.image || '',
                price: item.price || 0
              };
            }
          })
        );
        
        order.products = enrichedProducts;
      }
    }
    
    return new Response(JSON.stringify({ success: true, orders }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error?.message || "Unknown error" }), { status: 500 });
  }
}
