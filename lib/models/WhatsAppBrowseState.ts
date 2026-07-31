import mongoose, { Schema, model, models } from 'mongoose';

// Per-buyer conversational state for WhatsApp — one doc per waId. Covers BOTH search
// paging (lastQuery/offset, Phase 3 v1) and the checkout conversation (Phase 3 v2 core)
// added below. Kept as one document rather than two collections because cart naturally
// coexists with continued searching — a buyer adds an item, keeps browsing, adds
// another — so browse and checkout state are read/written together constantly.
//
// stage machine: browsing (default) -> cart -> awaiting_name (first-time buyers only)
// -> awaiting_address -> quoting_delivery -> choosing_couriers -> confirming_total ->
// awaiting_payment -> (back to browsing once handleOrderPaid confirms payment).
// 'quoting_delivery' is set only transiently during synchronous processing of the
// address message; it should essentially never be observed as a stored value between
// messages, but a message arriving while in it is treated as "re-collect the address"
// (lib/whatsapp/checkout.ts), since we can't be sure the quote fetch completed.
const WhatsAppBrowseStateSchema = new Schema({
  waId: { type: String, required: true, unique: true, index: true },
  lastQuery: { type: String },
  offset: { type: Number, default: 0 },

  stage: {
    type: String,
    enum: ['browsing', 'cart', 'awaiting_name', 'awaiting_address', 'quoting_delivery', 'choosing_couriers', 'confirming_total', 'awaiting_payment'],
    default: 'browsing',
  },
  // Cart line items: { productId, vendorId, vendorName, storeId, title, price, quantity, image }.
  // Mixed, matching the established convention for Order.vendors — this data is
  // read/written as whole objects, never queried by sub-field.
  cart: { type: [Schema.Types.Mixed], default: [] },
  // Collected during awaiting_address: { address, city, state, deliveryInstructions }.
  pendingShippingInfo: { type: Schema.Types.Mixed, default: {} },
  // Raw per-vendor quote results from the last getDeliveryQuotesForCart call — kept so
  // "choosing_couriers" can redisplay/re-validate options without re-fetching.
  deliveryQuotes: { type: Schema.Types.Mixed, default: {} },
  // Buyer's current per-vendor courier picks: { [vendorId]: { courierId, serviceCode, total, courierName, deliveryEta } }.
  selectedCouriers: { type: Schema.Types.Mixed, default: {} },
  // Set once an order is created and a Paystack link has been sent, so the buyer's
  // browse-state can be traced back to the order it's waiting on.
  pendingOrderId: { type: String },

  updatedAt: { type: Date, default: Date.now },
});

export const WhatsAppBrowseState =
  models.WhatsAppBrowseState || model('WhatsAppBrowseState', WhatsAppBrowseStateSchema);
