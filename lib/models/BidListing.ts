import mongoose, { Document, Schema, model, models } from 'mongoose'

export type BidListingStatus = 'draft' | 'live' | 'closed'

export interface IBidEntry {
  amount: number
  bidderName: string
  bidderEmail?: string
  createdAt: Date
}

export interface IBidListing extends Document {
  title: string
  description: string
  imageUrl?: string
  category?: string
  location?: string
  startPrice: number
  currentBid: number
  minIncrement: number
  reservePrice?: number
  endsAt: Date
  status: BidListingStatus
  featured: boolean
  bidCount: number
  createdBy?: string
  bids: IBidEntry[]
  createdAt?: Date
  updatedAt?: Date
}

const BidEntrySchema = new Schema<IBidEntry>(
  {
    amount: { type: Number, required: true },
    bidderName: { type: String, required: true, trim: true },
    bidderEmail: { type: String, trim: true, lowercase: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

const BidListingSchema = new Schema<IBidListing>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    imageUrl: { type: String, trim: true },
    category: { type: String, trim: true },
    location: { type: String, trim: true },
    startPrice: { type: Number, required: true, min: 1 },
    currentBid: { type: Number, required: true, min: 1 },
    minIncrement: { type: Number, default: 1000, min: 1 },
    reservePrice: { type: Number, min: 0 },
    endsAt: { type: Date, required: true },
    status: { type: String, enum: ['draft', 'live', 'closed'], default: 'live' },
    featured: { type: Boolean, default: false },
    bidCount: { type: Number, default: 0 },
    createdBy: { type: String },
    bids: { type: [BidEntrySchema], default: [] },
  },
  { timestamps: true }
)

BidListingSchema.index({ status: 1, endsAt: 1 })
BidListingSchema.index({ featured: 1, createdAt: -1 })

export const BidListing = models.BidListing || model<IBidListing>('BidListing', BidListingSchema)
