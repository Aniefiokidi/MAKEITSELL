import mongoose from 'mongoose';

const FollowSchema = new mongoose.Schema(
  {
    customerId: {
      type: String,
      required: true,
    },
    storeId: {
      type: String,
      required: true,
    },
    vendorId: {
      type: String,
      required: true,
    },
    customerName: {
      type: String,
    },
  },
  { timestamps: true }
);

// Create a unique index to prevent duplicate follows
FollowSchema.index({ customerId: 1, storeId: 1 }, { unique: true });

export const Follow = mongoose.models.Follow || mongoose.model('Follow', FollowSchema);
