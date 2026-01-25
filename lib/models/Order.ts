import mongoose, { Schema, Document, models } from 'mongoose';

export interface IOrder extends Document {
  orderId: string;
  customerId: string;
  items: any[];
  shippingInfo: any;
  shippingAddress: any;
  paymentMethod: string;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  vendors: any[];
  storeIds: string[];
  createdAt: Date;
  // Status timestamps
  confirmedAt?: Date;
  shippedAt?: Date;
  outForDeliveryAt?: Date;
  deliveredAt?: Date;
  receivedAt?: Date;
  cancelledAt?: Date;
}

const OrderSchema = new Schema<IOrder>({
  orderId: { type: String, required: true },
  customerId: { type: String, required: true },
  items: { type: Array, default: [] },
  shippingInfo: { type: Object },
  shippingAddress: { type: Object },
  paymentMethod: { type: String },
  totalAmount: { type: Number },
  status: { type: String },
  paymentStatus: { type: String },
  vendors: { type: Array, default: [] },
  storeIds: { type: Array, default: [] },
  createdAt: { type: Date, default: Date.now },
  confirmedAt: { type: Date },
  shippedAt: { type: Date },
  outForDeliveryAt: { type: Date },
  deliveredAt: { type: Date },
  receivedAt: { type: Date },
  cancelledAt: { type: Date },
});

export const Order = models.Order || mongoose.model<IOrder>('Order', OrderSchema);
