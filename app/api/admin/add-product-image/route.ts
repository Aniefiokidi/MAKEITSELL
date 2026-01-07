import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { Product } from "@/lib/models";

export async function POST(request: NextRequest) {
  await connectToDatabase();
  try {
    const { productId, imageUrl } = await request.json();
    if (!productId || !imageUrl) {
      return NextResponse.json({ success: false, error: "productId and imageUrl are required" }, { status: 400 });
    }
    const product = await Product.findById(productId);
    if (!product) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
    }
    // Add image to images array if not present
    if (!Array.isArray(product.images)) product.images = [];
    if (!product.images.includes(imageUrl)) {
      product.images.push(imageUrl);
      await product.save();
    }
    return NextResponse.json({ success: true, product });
  } catch (error) {
    return NextResponse.json({ success: false, error: error?.message || error });
  }
}
