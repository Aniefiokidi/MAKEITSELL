import mongoose, { Schema, Document, models } from 'mongoose';

export interface ICart extends Document {
  userId: string;
  items: any[];
  updatedAt?: Date;
}

const CartSchema = new Schema<ICart>({
  userId: { type: String, required: true, unique: true },
  items: { type: [Schema.Types.Mixed], default: [] },
}, { timestamps: { updatedAt: true, createdAt: false } });

export const Cart = models.Cart || mongoose.model<ICart>('Cart', CartSchema);
