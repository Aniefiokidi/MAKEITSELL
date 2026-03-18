import mongoose, { Schema, Document, models } from 'mongoose';

export interface IBooking extends Document {
  serviceId: string;
  selectedPackageId?: string;
  selectedPackageName?: string;
  selectedAddOns?: Array<{
    id: string;
    name: string;
    pricingType: 'fixed' | 'percentage';
    amount: number;
  }>;
  estimatedPrice?: number;
  finalPrice?: number;
  pricingStatus?: 'estimated' | 'quoted' | 'accepted';
  requiresQuote?: boolean;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  providerId: string;
  providerName: string;
  serviceTitle: string;
  bookingDate: Date;
  startTime: string;
  endTime: string;
  duration: number;
  totalPrice: number;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  quoteSentAt?: Date;
  quoteExpiresAt?: Date;
  quoteReminderSentAt?: Date;
  quoteReminderCount?: number;
  quoteExpiredAt?: Date;
  cancellationPolicyPercent?: number;
  cancellationWindowHours?: number;
  cancellationFeeApplied?: boolean;
  cancellationFeeAmount?: number;
  cancellationFeeStatus?: "none" | "charged" | "pending" | "waived";
  cancelledAt?: Date;
  cancellationReason?: string;
  customerLocation?: string;
  serviceAddress?: string;
  rescheduleCount?: number;
  rescheduledFromBookingId?: string;
  rescheduledToBookingId?: string;
  lastRescheduledAt?: Date;
  locationType: "online" | "store" | "home-service" | "in-person" | "both";
  location: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema = new Schema<IBooking>({
  serviceId: { type: String, required: true },
  selectedPackageId: { type: String },
  selectedPackageName: { type: String },
  selectedAddOns: {
    type: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
        pricingType: { type: String, enum: ['fixed', 'percentage'], required: true },
        amount: { type: Number, required: true },
      },
    ],
    default: [],
  },
  estimatedPrice: { type: Number },
  finalPrice: { type: Number },
  pricingStatus: { type: String, enum: ['estimated', 'quoted', 'accepted'], default: 'estimated' },
  requiresQuote: { type: Boolean, default: false },
  customerId: { type: String, required: true },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  customerPhone: { type: String },
  providerId: { type: String, required: true },
  providerName: { type: String, required: true },
  serviceTitle: { type: String, required: true },
  bookingDate: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  duration: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  status: { type: String, enum: ["pending", "confirmed", "completed", "cancelled"], default: "pending" },
  quoteSentAt: { type: Date },
  quoteExpiresAt: { type: Date, index: true },
  quoteReminderSentAt: { type: Date },
  quoteReminderCount: { type: Number, default: 0 },
  quoteExpiredAt: { type: Date },
  cancellationPolicyPercent: { type: Number, default: 30 },
  cancellationWindowHours: { type: Number, default: 24 },
  cancellationFeeApplied: { type: Boolean, default: false },
  cancellationFeeAmount: { type: Number, default: 0 },
  cancellationFeeStatus: { type: String, enum: ["none", "charged", "pending", "waived"], default: "none" },
  cancelledAt: { type: Date },
  cancellationReason: { type: String },
  customerLocation: { type: String },
  serviceAddress: { type: String },
  rescheduleCount: { type: Number, default: 0 },
  rescheduledFromBookingId: { type: String },
  rescheduledToBookingId: { type: String },
  lastRescheduledAt: { type: Date },
  // Keep legacy values (in-person/both) while accepting current service values.
  locationType: { type: String, enum: ["online", "store", "home-service", "in-person", "both"], required: true },
  location: { type: String, required: true },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const Booking = models.Booking || mongoose.model<IBooking>('Booking', BookingSchema);
