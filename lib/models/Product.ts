import mongoose, { Schema, Document, models } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  description?: string;
  price: number;
  images: string[];
  productDocuments?: string[];
  vendorId: string;
  vendorName?: string;
  storeId?: string;
  category?: string;
  subcategory?: string;
  stock?: number;
  sku?: string;
  featured?: boolean;
  status?: 'active' | 'inactive' | 'out_of_stock';
  sales?: number;
  hasColorOptions?: boolean;
  hasSizeOptions?: boolean;
  colors?: string[];
  sizes?: string[];
  colorImages?: { [key: string]: string };
  createdAt?: Date;
  updatedAt?: Date;
}

const ProductSchema = new Schema<IProduct>({
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  images: { type: [String], default: [] },
  productDocuments: { type: [String], default: [] },
  vendorId: { type: String, required: true },
  vendorName: { type: String },
  storeId: { type: String },
  category: { type: String },
  subcategory: { type: String },
  stock: { type: Number, default: 0 },
  sku: { type: String },
  featured: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'inactive', 'out_of_stock'], default: 'active' },
  sales: { type: Number, default: 0 },
  hasColorOptions: { type: Boolean, default: false },
  hasSizeOptions: { type: Boolean, default: false },
  colors: { type: [String], default: [] },
  sizes: { type: [String], default: [] },
  colorImages: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

// Query indexes for high-traffic product listing/filter endpoints.
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ vendorId: 1, createdAt: -1 });
ProductSchema.index({ category: 1, createdAt: -1 });
ProductSchema.index({ category: 1, subcategory: 1, createdAt: -1 });
ProductSchema.index({ featured: 1, createdAt: -1 });
ProductSchema.index({ status: 1, createdAt: -1 });
ProductSchema.index({ vendorId: 1, status: 1, createdAt: -1 });

export const Product = models.Product || mongoose.model<IProduct>('Product', ProductSchema);
