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
  // Phase S4 Part A — counter-offer negotiation layered onto a 'quoted' booking, without a
  // new pricingStatus value (the SLA cron and vendor-dashboard PATCH route only understand
  // the three values above, and "quoted" already means "there's a live number on the
  // table"). Undefined quoteLastOfferBy is treated as equivalent to 'provider' — the only
  // way pricingStatus becomes 'quoted' before any negotiation happens — so every booking
  // quoted before this shipped stays backward-compatible with no migration needed.
  quoteLastOfferBy?: 'provider' | 'buyer';
  quoteNegotiationRound?: number;
  quoteNegotiationHistory?: Array<{ by: 'provider' | 'buyer'; amount: number; at: Date }>;
  // Phase S4 Part B — set when this booking was created from an agreed PriceNegotiation
  // (pre-booking haggling on a requiresQuote:false service), so the price it was created at
  // is traceable back to a real negotiation. See initiateBookingPayment (lib/booking-payment.ts)
  // for the claim/validate/consume logic that stamps this.
  negotiationId?: string;
  // Cloudinary URLs — job photos attached to a quote request. Currently only ever
  // populated by the WhatsApp quote-request flow (lib/whatsapp/service-quote.ts); the web
  // BookingModal has no upload step for a requiresQuote booking today, so this is empty
  // for every web-originated quote request. Shown on the provider's existing dashboard
  // (app/vendor/bookings/page.tsx) regardless of origin.
  requestPhotos?: string[];
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
  bookingFeeAmount?: number;
  bookingFeeStatus?: "pending" | "charged" | "waived";
  bookingFeeReference?: string;
  // Deposit-based payment model (replaces the old flat ₦500 wallet booking fee): customer
  // pays a 10% deposit of totalPrice + the flat bookingFeeAmount (now ₦1,000) via Paystack
  // at booking time; balanceOwed is the remaining 90%, settled offline with the provider.
  // paymentStatus is the idempotency-guard field for handleBookingPaid (lib/booking-payment-confirmation.ts)
  // — separate from `status` above, which tracks the booking/appointment lifecycle, not the payment one.
  depositAmount?: number;
  balanceOwed?: number;
  paymentStatus?: "pending" | "paid";
  paymentReference?: string;
  paymentData?: any;
  paidAt?: Date;
  paymentMethod?: "wallet" | "paystack";
  cancellationFeeApplied?: boolean;
  cancellationFeeAmount?: number;
  cancellationFeeStatus?: "none" | "charged" | "pending" | "waived";
  cancelledAt?: Date;
  cancellationReason?: string;
  completedAt?: Date;
  customerLocation?: string;
  tripDistanceMiles?: number;
  serviceAddress?: string;
  stayDetails?: {
    checkInDate: Date;
    checkOutDate: Date;
    nights: number;
    roomTypeId?: string;
    roomTypeName?: string;
    rooms: number;
    adults?: number;
    children?: number;
    guests?: number;
    pricePerNight?: number;
  };
  requirementDetails?: {
    event?: {
      name?: string;
      date?: string;
      guestCount?: number;
      venue?: string;
    };
    logistics?: {
      pickupAddress?: string;
      dropoffAddress?: string;
      packageDescription?: string;
      receiverName?: string;
      receiverPhone?: string;
    };
    creative?: {
      preferredPlatform?: string;
      deliverableFormat?: string;
    };
  };
  rescheduleCount?: number;
  rescheduledFromBookingId?: string;
  rescheduledToBookingId?: string;
  lastRescheduledAt?: Date;
  reminderSent24h?: boolean;
  reminderSentDayOf?: boolean;
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
  quoteLastOfferBy: { type: String, enum: ['provider', 'buyer'] },
  quoteNegotiationRound: { type: Number, default: 0 },
  quoteNegotiationHistory: {
    type: [
      {
        by: { type: String, enum: ['provider', 'buyer'], required: true },
        amount: { type: Number, required: true },
        at: { type: Date, default: Date.now },
      },
    ],
    default: [],
  },
  negotiationId: { type: String },
  requestPhotos: { type: [String], default: [] },
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
  bookingFeeAmount: { type: Number, default: 0 },
  bookingFeeStatus: { type: String, enum: ["pending", "charged", "waived"], default: "waived" },
  bookingFeeReference: { type: String },
  depositAmount: { type: Number, default: 0 },
  balanceOwed: { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ["pending", "paid"], default: "pending" },
  paymentReference: { type: String },
  paymentData: { type: Schema.Types.Mixed },
  paidAt: { type: Date },
  paymentMethod: { type: String, enum: ["wallet", "paystack"], default: "paystack" },
  cancellationFeeApplied: { type: Boolean, default: false },
  cancellationFeeAmount: { type: Number, default: 0 },
  cancellationFeeStatus: { type: String, enum: ["none", "charged", "pending", "waived"], default: "none" },
  cancelledAt: { type: Date },
  cancellationReason: { type: String },
  completedAt: { type: Date },
  customerLocation: { type: String },
  tripDistanceMiles: { type: Number },
  serviceAddress: { type: String },
  stayDetails: {
    type: {
      checkInDate: { type: Date },
      checkOutDate: { type: Date },
      nights: { type: Number },
      roomTypeId: { type: String },
      roomTypeName: { type: String },
      rooms: { type: Number },
      adults: { type: Number },
      children: { type: Number },
      guests: { type: Number },
      pricePerNight: { type: Number },
    },
    default: null,
  },
  requirementDetails: {
    type: {
      event: {
        name: { type: String },
        date: { type: String },
        guestCount: { type: Number },
        venue: { type: String },
      },
      logistics: {
        pickupAddress: { type: String },
        dropoffAddress: { type: String },
        packageDescription: { type: String },
        receiverName: { type: String },
        receiverPhone: { type: String },
      },
      creative: {
        preferredPlatform: { type: String },
        deliverableFormat: { type: String },
      },
    },
    default: null,
  },
  rescheduleCount: { type: Number, default: 0 },
  rescheduledFromBookingId: { type: String },
  rescheduledToBookingId: { type: String },
  lastRescheduledAt: { type: Date },
  reminderSent24h: { type: Boolean, default: false },
  reminderSentDayOf: { type: Boolean, default: false },
  // Keep legacy values (in-person/both) while accepting current service values.
  locationType: { type: String, enum: ["online", "store", "home-service", "in-person", "both"], required: true },
  location: { type: String, required: true },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const Booking = models.Booking || mongoose.model<IBooking>('Booking', BookingSchema);
