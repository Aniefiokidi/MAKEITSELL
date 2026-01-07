import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { Product } from "@/lib/models";

export async function POST(request: NextRequest) {
  await connectToDatabase();
  let fixedCount = 0;
  let checkedCount = 0;
  let errors: any[] = [];

  try {
    const products = await Product.find({}).lean().exec();
    for (const prod of products) {
      checkedCount++;
      // If images is missing or empty, but image or imageUrl exists, fix it
      if (!Array.isArray(prod.images) || prod.images.length === 0) {
        let newImages: string[] = [];
        if (prod.image) newImages.push(prod.image);
        if (prod.imageUrl) newImages.push(prod.imageUrl);
        // Remove falsy values and duplicates
        newImages = Array.from(new Set(newImages.filter(Boolean)));
        if (newImages.length > 0) {
          try {
            await Product.findByIdAndUpdate(prod._id, { images: newImages });
            fixedCount++;
          } catch (err) {
            errors.push({ id: prod._id, error: err });
          }
        }
      }
    }
    return NextResponse.json({ success: true, checked: checkedCount, fixed: fixedCount, errors });
  } catch (error) {
    return NextResponse.json({ success: false, error: error?.message || error });
  }
}
