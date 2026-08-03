import mongoose, { Schema, models } from 'mongoose'

// Field names deliberately match app/checkout/page.tsx's shippingInfo state (address,
// city, state, zipCode, deliveryInstructions, firstName/lastName, phoneCountryCode/phone)
// so a saved address can populate that form via a single merge with no field mapping —
// this is the richest of the several address shapes already in the codebase (checkout's
// own payload, the profile page's legacy single address, and Order's derived
// shippingAddress sub-object all spell zipCode/deliveryInstructions differently).
const SavedAddressItemSchema = new Schema({
  label:               { type: String, required: true }, // e.g. "Home", "Office"
  firstName:           { type: String, default: '' },
  lastName:            { type: String, default: '' },
  phoneCountryCode:    { type: String, default: '+234' },
  phone:               { type: String, default: '' },
  address:             { type: String, required: true },
  city:                { type: String, required: true },
  state:               { type: String, required: true },
  zipCode:             { type: String, default: '' },
  deliveryInstructions: { type: String, default: '' },
  isDefault:           { type: Boolean, default: false },
  createdAt:           { type: Date, default: Date.now },
})

const SavedAddressSchema = new Schema({
  userId:    { type: String, required: true, unique: true },
  addresses: { type: [SavedAddressItemSchema], default: [] },
}, { timestamps: true })

export const SavedAddress = models.SavedAddress || mongoose.model('SavedAddress', SavedAddressSchema)
