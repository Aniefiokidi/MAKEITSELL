import { Schema, model, models } from 'mongoose'

const MonthlyChampionSchema = new Schema({
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  vendorId: { type: String, required: true },
  vendorName: { type: String },
  storeName: { type: String },
  winningGMV: { type: Number, required: true },
  prizeAmount: { type: Number, default: 40000 },
  creditedAt: { type: Date, default: Date.now },
  acknowledged: { type: Boolean, default: false },
})

MonthlyChampionSchema.index({ month: 1, year: 1 }, { unique: true })

export const MonthlyChampion =
  models.MonthlyChampion || model('MonthlyChampion', MonthlyChampionSchema)
