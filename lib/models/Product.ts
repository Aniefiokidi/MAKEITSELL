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
  lowStockThreshold?: number;
  sku?: string;
  featured?: boolean;
  status?: 'active' | 'inactive' | 'out_of_stock';
  sales?: number;
  // Deprecated in favor of `variants` (label: "Color"/"Size") below — see
  // lib/product-variants.ts. Kept for backward compatibility with existing products;
  // never written to by new code.
  hasColorOptions?: boolean;
  hasSizeOptions?: boolean;
  colors?: string[];
  sizes?: string[];
  colorImages?: { [key: string]: string };
  // Phone Cases only (category: Electronics, subcategory: Phone Cases) — which phone
  // models this case fits, and how many units are in stock for each, picked from the
  // curated list in lib/phone-models.ts. Legacy products created before per-model stock
  // existed may still have this as a plain string[] — see normalizeCompatiblePhoneModels
  // in lib/phone-models.ts, which every reader of this field goes through.
  // Deprecated in favor of the generalized `variants` field below — kept for backward
  // compatibility with already-live Phone Cases products; see lib/product-variants.ts's
  // normalizeProductVariants, which synthesizes `variants`-shaped entries from this field
  // on read. Never written to by new code.
  compatiblePhoneModels?: Array<{ model: string; stock: number }> | string[];
  // Generalized per-variant stock, replacing compatiblePhoneModels/colors/sizes as the
  // single source of truth for any product needing per-option inventory — a specific
  // compatible device model, a color, a size, or a vendor's own custom dimension (e.g.
  // "Compatible Car Model"). `label` names the dimension ("Compatible Phone Model",
  // "Color", ...), `value` is the specific option ("iPhone 15 Pro", "Red", ...). Multiple
  // labels on one product (e.g. both "Color" and "Size") are tracked as independent stock
  // pools, not a combination matrix — see lib/product-variants.ts for the full contract
  // and normalizeProductVariants, which every reader of variant data goes through
  // (transparently falling back to the legacy fields above for products that predate this
  // field). A real typed subdocument array, not Schema.Types.Mixed — unlike
  // compatiblePhoneModels there is no legacy shape to tolerate here, and the atomic
  // per-variant stock decrement (lib/product-stock.ts) already bypasses Mongoose casting
  // entirely via the raw driver, so a real schema costs nothing on that path while buying
  // real validation on the normal vendor-form write path.
  variants?: Array<{ label: string; value: string; stock: number }>;
  weightKg?: number;
  dimensions?: { length: number; width: number; height: number };
  // Perceptual hash (dHash, 16 hex chars = 64 bits) of images[0] — near-duplicate
  // matching (a buyer forwarding a saved/screenshotted product photo).
  imageHash?: string;
  // Broad visual bucket (clothing, food, beauty-personal-care, ...) from a locally-run
  // MobileNet classifier — no AI/vision API call. See lib/image-classify.ts.
  visualCategory?: string;
  // MobileNet embedding (512-dim) of images[0] — cosine-similarity ranking for "similar,
  // not identical" items, which a pixel-level hash can't generalize to.
  imageEmbedding?: number[];
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
  lowStockThreshold: { type: Number, default: 3 },
  sku: { type: String },
  featured: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'inactive', 'out_of_stock'], default: 'active' },
  sales: { type: Number, default: 0 },
  hasColorOptions: { type: Boolean, default: false },
  hasSizeOptions: { type: Boolean, default: false },
  colors: { type: [String], default: [] },
  sizes: { type: [String], default: [] },
  colorImages: { type: Schema.Types.Mixed, default: {} },
  // Mixed, not a typed subdocument array — deliberately, so Mongoose never attempts to
  // cast a legacy string[] value (pre-dating per-model stock) into the new
  // {model,stock} shape and throw on it. Both shapes are handled at the application
  // level (see normalizeCompatiblePhoneModels in lib/phone-models.ts); the atomic
  // per-model $elemMatch/positional-$ update in lib/product-stock.ts operates on the
  // raw stored array and works the same regardless of this field's declared Mongoose
  // type.
  compatiblePhoneModels: { type: Schema.Types.Mixed, default: [] },
  // Real typed subdocument array — see the interface comment above for why this one
  // (unlike compatiblePhoneModels/colorImages) doesn't need Schema.Types.Mixed.
  variants: {
    type: [{
      label: { type: String, required: true },
      value: { type: String, required: true },
      stock: { type: Number, required: true, min: 0, default: 0 },
      _id: false,
    }],
    default: [],
  },
  // Optional — used for real shipping-rate quotes (Shipbubble). Left unset, rate
  // requests fall back to a sensible default box + weight rather than failing.
  weightKg: { type: Number },
  dimensions: {
    type: {
      length: { type: Number },
      width: { type: Number },
      height: { type: Number },
    },
  },
  imageHash: { type: String },
  visualCategory: { type: String },
  imageEmbedding: { type: [Number] },
}, { timestamps: true });

// Query indexes for high-traffic product listing/filter endpoints.
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ vendorId: 1, createdAt: -1 });
ProductSchema.index({ category: 1, createdAt: -1 });
ProductSchema.index({ category: 1, subcategory: 1, createdAt: -1 });
ProductSchema.index({ featured: 1, createdAt: -1 });
ProductSchema.index({ status: 1, createdAt: -1 });
ProductSchema.index({ vendorId: 1, status: 1, createdAt: -1 });

// Weighted text index for relevance-ranked search (name matches count far more than a
// hit buried in the description) — replaces plain substring regex matching, which has
// no concept of relevance and no stemming (e.g. "shoes" vs "shoe").
ProductSchema.index(
  { name: 'text', category: 'text', subcategory: 'text', description: 'text', vendorName: 'text' },
  { weights: { name: 10, category: 5, subcategory: 3, vendorName: 3, description: 1 }, name: 'ProductTextIndex' }
);

export const Product = models.Product || mongoose.model<IProduct>('Product', ProductSchema);
