import mongoose, { Schema, models } from 'mongoose'

// Lightweight tracking record for a buyer connecting to a service provider over
// WhatsApp instead of booking (and paying) in-app — see app/service/[id]/page.tsx and
// app/api/services/[id]/contact/route.ts. Deliberately NOT a Booking: no price, no
// pricingStatus, no payment fields at all — services aren't monetized right now. Exists
// only so (a) a buyer can self-report "I received this service" and become eligible to
// review it (app/api/services/[id]/can-review/route.ts falls back to this when there's
// no completed Booking), matching the same role a completed Booking/Order plays for
// service/product reviews elsewhere.
const ServiceContactSchema = new Schema({
  customerId: { type: String, required: true, index: true },
  serviceId: { type: String, required: true, index: true },
  providerId: { type: String, required: true },
  serviceTitle: { type: String, default: '' },
  providerName: { type: String, default: '' },
  status: { type: String, enum: ['contacted', 'received'], default: 'contacted' },
  contactedAt: { type: Date, default: Date.now },
  receivedAt: { type: Date, default: null },
})

// One tracking record per buyer+service — re-clicking "Book" just refreshes
// contactedAt via upsert rather than creating a duplicate (see the POST route).
ServiceContactSchema.index({ customerId: 1, serviceId: 1 }, { unique: true })

export const ServiceContact = models.ServiceContact || mongoose.model('ServiceContact', ServiceContactSchema)
