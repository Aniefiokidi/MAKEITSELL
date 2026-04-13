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
  paymentReference?: string;
  paymentData?: any;
  paidAt?: Date;
  escrowReleaseAt?: Date;
  deliveryType?: 'local' | 'interstate';
  releasedAt?: Date;
  vendors: any[];
  storeIds: string[];
  createdAt: Date;
  disputeStatus?: string;
  disputeData?: any;
  disputeRaisedAt?: Date;
  disputeClaimedById?: string;
  disputeClaimedByEmail?: string;
  disputeClaimedByName?: string;
  disputeClaimedAt?: Date;
  escrowReminderSentAt?: Date;
  refundedAt?: Date;
  refundedByAdminId?: string;
  refundedByAdminEmail?: string;
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
  items: { type: [Schema.Types.Mixed] as any, default: [] },
  shippingInfo: { type: Object },
  shippingAddress: { type: Object },
  paymentMethod: { type: String },
  totalAmount: { type: Number },
  status: { type: String },
  paymentStatus: { type: String },
  paymentReference: { type: String, index: true },
  paymentData: { type: Schema.Types.Mixed as any },
  paidAt: { type: Date },
  escrowReleaseAt: { type: Date, index: true },
  deliveryType: { type: String, enum: ['local', 'interstate'] },
  releasedAt: { type: Date },
  vendors: { type: [Schema.Types.Mixed] as any, default: [] },
  storeIds: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
  disputeStatus: { type: String, index: true },
  disputeData: { type: Schema.Types.Mixed as any },
  disputeRaisedAt: { type: Date, index: true },
  disputeClaimedById: { type: String, index: true },
  disputeClaimedByEmail: { type: String },
  disputeClaimedByName: { type: String },
  disputeClaimedAt: { type: Date },
  escrowReminderSentAt: { type: Date, index: true },
  refundedAt: { type: Date },
  refundedByAdminId: { type: String, index: true },
  refundedByAdminEmail: { type: String },
  confirmedAt: { type: Date },
  shippedAt: { type: Date },
  outForDeliveryAt: { type: Date },
  deliveredAt: { type: Date },
  receivedAt: { type: Date },
  cancelledAt: { type: Date },
});

export const Order = models.Order || mongoose.model<IOrder>('Order', OrderSchema);
