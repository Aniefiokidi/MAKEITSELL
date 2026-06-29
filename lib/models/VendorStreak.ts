import mongoose, { Schema, Document, models } from 'mongoose'

export interface IMonthlyRecord {
  month: number
  year: number
  targetOrderCount: number
  actualOrderCount: number
  hit: boolean
  gmvThatMonth: number
  platformFeeEarned: number
}

export interface IStreakPrize {
  milestone: number
  paidAt: Date
  amount: number
}

export interface IVendorStreak extends Document {
  vendorId: string
  targetOrderCount: number
  floorOrderCount: number
  floorLockedAt: Date
  lowestProductPriceAtLock: number
  isDefaultFloor: boolean
  hasSetTarget: boolean
  currentStreak: number
  longestStreak: number
  monthlyRecords: IMonthlyRecord[]
  streakPrizesPaid: IStreakPrize[]
  needsTargetReview?: boolean
  createdAt: Date
  updatedAt: Date
}

const MonthlyRecordSchema = new Schema<IMonthlyRecord>({
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  targetOrderCount: { type: Number, required: true },
  actualOrderCount: { type: Number, required: true },
  hit: { type: Boolean, required: true },
  gmvThatMonth: { type: Number, default: 0 },
  platformFeeEarned: { type: Number, default: 0 },
}, { _id: false })

const StreakPrizeSchema = new Schema<IStreakPrize>({
  milestone: { type: Number, required: true },
  paidAt: { type: Date, required: true },
  amount: { type: Number, required: true },
}, { _id: false })

const VendorStreakSchema = new Schema<IVendorStreak>({
  vendorId: { type: String, required: true, unique: true, index: true },
  targetOrderCount: { type: Number, default: 0 },
  floorOrderCount: { type: Number, default: 26 },
  floorLockedAt: { type: Date },
  lowestProductPriceAtLock: { type: Number, default: 0 },
  isDefaultFloor: { type: Boolean, default: true },
  hasSetTarget: { type: Boolean, default: false },
  currentStreak: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  monthlyRecords: { type: [MonthlyRecordSchema], default: [] },
  streakPrizesPaid: { type: [StreakPrizeSchema], default: [] },
  needsTargetReview: { type: Boolean, default: false },
}, { timestamps: true })

export const VendorStreak = models.VendorStreak || mongoose.model<IVendorStreak>('VendorStreak', VendorStreakSchema)
