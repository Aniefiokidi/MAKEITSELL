import { Schema, model, models } from 'mongoose'

const WalletTransactionSchema = new Schema({
  userId: { type: String, required: true, index: true },
  type: { type: String, enum: ['topup', 'withdrawal'], required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending', index: true },
  reference: { type: String, required: true, unique: true, index: true },
  paymentReference: { type: String, index: true },
  provider: { type: String, default: 'paystack' },
  note: { type: String },
  metadata: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
})

export const WalletTransaction =
  models.WalletTransaction || model('WalletTransaction', WalletTransactionSchema)
