import mongoose, { Schema, Document, models } from 'mongoose';

export interface IBooking extends Document {
  serviceId: string;
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
  locationType: "online" | "in-person" | "both";
  location: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema = new Schema<IBooking>({
  serviceId: { type: String, required: true },
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
  locationType: { type: String, enum: ["online", "in-person", "both"], required: true },
  location: { type: String, required: true },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const Booking = models.Booking || mongoose.model<IBooking>('Booking', BookingSchema);
