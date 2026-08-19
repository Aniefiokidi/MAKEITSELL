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
  // Which catalog "categories"/"more"/free-text fallback currently operate on — goods and
  // services are entirely separate taxonomies and search indexes (see
  // lib/whatsapp/buyer.ts's SERVICE_ENTRY_KEYWORDS). Defaults to 'goods' so a buyer who
  // never mentions services behaves identically to before this field existed.
  browseMode: { type: String, enum: ['goods', 'services'], default: 'goods' },
  lastQuery: { type: String },
  // Set instead of lastQuery when the last services browse was a category-menu tap rather
  // than a typed search — services store clean category slugs ("beauty") on the document,
  // unlike goods' free-text vendor-entered category strings ("Health & Beauty", "Curls"),
  // so this is queried as an exact match rather than reusing the free-text search path.
  // Mutually exclusive with lastQuery for services paging — whichever was set most
  // recently is what "more" continues. Not used by goods browsing at all.
  lastCategorySlug: { type: String },
  // Set instead of lastQuery when the last "search" was a buyer photo (see
  // lib/whatsapp/image-search.ts) — mutually exclusive with lastQuery, whichever was set
  // most recently is what "more" continues paging through. matchMode distinguishes a
  // dHash near-duplicate hit (lastImageHash) from an embedding-similarity search
  // (lastImageEmbedding + lastVisualCategory), since "more" pages through each
  // differently.
  matchMode: { type: String, enum: ['duplicate', 'embedding'] },
  lastImageHash: { type: String },
  lastImageEmbedding: { type: [Number] },
  lastVisualCategory: { type: String },
  offset: { type: Number, default: 0 },

  stage: {
    type: String,
    enum: [
      'browsing', 'cart', 'awaiting_name', 'awaiting_address', 'quoting_delivery', 'choosing_couriers', 'confirming_total', 'awaiting_payment',
      // Services booking conversation (Phase S2, lib/whatsapp/service-booking.ts):
      // choosing_service_package -> choosing_service_addons (skipped if the service has
      // none) -> choosing_booking_slot -> confirming_booking -> awaiting_booking_payment
      // -> (back to browsing once handleBookingPaid confirms payment). Kept as separate
      // stage names from the goods ones above (not reused) even though the same
      // "blocking, owns the whole next message" mechanism applies to both — see
      // SERVICE_BOOKING_BLOCKING_STAGES in lib/whatsapp/buyer.ts.
      'choosing_service_package', 'choosing_service_addons', 'choosing_booking_slot', 'confirming_booking', 'awaiting_booking_payment',
      // Quote-request conversation (Phase S3 part A, lib/whatsapp/service-quote.ts), for
      // requiresQuote: true services: collecting_quote_description ->
      // collecting_quote_location -> choosing_quote_slot -> collecting_quote_photos ->
      // (back to browsing once submitted, fee-free, awaiting the provider's quote from
      // their existing dashboard). Accepting/declining a delivered quote is deliberately
      // NOT a blocking stage — see QUOTE_DECISION_PATTERN in that file for why.
      'collecting_quote_description', 'collecting_quote_location', 'choosing_quote_slot', 'collecting_quote_photos',
    ],
    default: 'browsing',
  },
  // Cart line items: { productId, vendorId, vendorName, storeId, title, price, quantity, image }.
  // Mixed, matching the established convention for Order.vendors — this data is
  // read/written as whole objects, never queried by sub-field.
  cart: { type: [Schema.Types.Mixed], default: [] },
  // Collected during awaiting_address: { address, city, state, deliveryInstructions }.
  pendingShippingInfo: { type: Schema.Types.Mixed, default: {} },
  // Set to a SavedAddress subdocument _id when pendingShippingInfo came from picking a
  // saved address (rather than being freshly typed) — checkout.ts's confirm step uses
  // this to skip auto-saving an address that's already saved.
  pendingShippingInfoFromSavedId: { type: String },
  // Raw per-vendor quote results from the last getDeliveryQuotesForCart call — kept so
  // "choosing_couriers" can redisplay/re-validate options without re-fetching.
  deliveryQuotes: { type: Schema.Types.Mixed, default: {} },
  // Buyer's current per-vendor courier picks: { [vendorId]: { courierId, serviceCode, total, courierName, deliveryEta } }.
  selectedCouriers: { type: Schema.Types.Mixed, default: {} },
  // Set once an order is created and a Paystack link has been sent, so the buyer's
  // browse-state can be traced back to the order it's waiting on.
  pendingOrderId: { type: String },

  // In-progress booking selection, built up across choosing_service_package ->
  // choosing_service_addons -> choosing_booking_slot -> confirming_booking. Mixed, same
  // convention as cart/pendingShippingInfo above — read/written as a whole object.
  // Shape: { serviceId, providerId, providerName, serviceTitle, locationType, location,
  // packageOptions (snapshot, so a mid-conversation vendor edit can't shift prices out
  // from under a buyer already selecting), selectedPackageId, selectedPackageName,
  // selectedPackagePrice, selectedPackageDuration, addOnOptions (snapshot),
  // selectedAddOns, bookingDate, startTime, endTime, totalPrice }.
  bookingDraft: { type: Schema.Types.Mixed, default: {} },
  // Set once a booking is created and a Paystack link has been sent — same role as
  // pendingOrderId above, for lib/whatsapp/service-booking.ts's booking flow.
  pendingBookingId: { type: String },

  // Re-fire guard for app/api/admin/whatsapp-cart-recovery-job — mirrors Cart.recoveryEmailSentAt's
  // "skip if we already nudged for this exact cart state" semantics (compared against
  // updatedAt, not a fixed TTL, so a cart touched again after a nudge gets a fresh one).
  cartRecoverySentAt: { type: Date, default: null },

  updatedAt: { type: Date, default: Date.now },
});

export const WhatsAppBrowseState =
  models.WhatsAppBrowseState || model('WhatsAppBrowseState', WhatsAppBrowseStateSchema);
