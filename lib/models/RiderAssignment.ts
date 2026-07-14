import mongoose, { Schema, Document, models } from 'mongoose';

export interface IRiderAssignment extends Document {
  orderId: string;
  vendorId?: string;
  storeId?: string;
  rowId: string;
  region: 'lagos' | 'abuja';
  customerId: string;
  riderId: string;
  riderName?: string;
  riderPhone?: string;
  assignedByEmail?: string;
  status: 'assigned' | 'picked_up' | 'en_route' | 'arrived' | 'delivered';
  destination: {
    lat: number;
    lng: number;
    address?: string;
    source?: 'geocode' | 'manual';
  };
  geofenceRadiusMeters: number;
  trackingToken: string;
  assignedAt?: Date;
  pickedUpAt?: Date;
  enRouteAt?: Date;
  arrivedAt?: Date;
  deliveredAt?: Date;
  arrivalNotifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RiderAssignmentSchema = new Schema<IRiderAssignment>({
  orderId: { type: String, required: true, index: true },
  vendorId: { type: String, default: '' },
  storeId: { type: String, default: '' },
  rowId: { type: String, required: true, unique: true },
  region: { type: String, enum: ['lagos', 'abuja'], required: true },
  customerId: { type: String, required: true, index: true },
  riderId: { type: String, required: true, index: true },
  riderName: { type: String },
  riderPhone: { type: String },
  assignedByEmail: { type: String },
  status: {
    type: String,
    enum: ['assigned', 'picked_up', 'en_route', 'arrived', 'delivered'],
    default: 'assigned',
  },
  destination: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    address: { type: String },
    source: { type: String, enum: ['geocode', 'manual'] },
  },
  geofenceRadiusMeters: { type: Number, default: 200 },
  trackingToken: { type: String, required: true, unique: true },
  assignedAt: { type: Date },
  pickedUpAt: { type: Date },
  enRouteAt: { type: Date },
  arrivedAt: { type: Date },
  deliveredAt: { type: Date },
  arrivalNotifiedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const RiderAssignment = models.RiderAssignment || mongoose.model<IRiderAssignment>('RiderAssignment', RiderAssignmentSchema);
