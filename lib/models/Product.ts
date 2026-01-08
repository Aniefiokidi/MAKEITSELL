import mongoose, { Schema, Document, models } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  description?: string;
  price: number;
  images: string[];
  vendorId: string;
  category?: string;
  stock?: number;
  status?: 'active' | 'inactive' | 'out_of_stock';
  createdAt?: Date;
  updatedAt?: Date;
}

const ProductSchema = new Schema<IProduct>({
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  images: { type: [String], default: [] },
  vendorId: { type: String, required: true },
  category: { type: String },
  stock: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'inactive', 'out_of_stock'], default: 'active' },
}, { timestamps: true });

export const Product = models.Product || mongoose.model<IProduct>('Product', ProductSchema);
