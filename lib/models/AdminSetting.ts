import mongoose, { Schema, model, models } from 'mongoose'

const AdminSettingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: Schema.Types.Mixed, required: true },
    updatedBy: { type: String },
  },
  {
    timestamps: true,
  }
)

export const AdminSetting =
  models.AdminSetting || model('AdminSetting', AdminSettingSchema)
