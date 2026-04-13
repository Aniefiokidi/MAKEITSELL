import { Order as OrderModel } from './models/Order';
import ConversationModel, { IConversation } from './models/Conversation';
import MessageModel, { IMessage } from './models/Message';
export const createOrder = async (orderData: any): Promise<string> => {
  await connectToDatabase();
  const order: any = await OrderModel.create(orderData as any);
  return order?._id?.toString?.() || '';
};

export const getOrderById = async (orderId: string) => {
  await connectToDatabase();
  // orderId is a UUID string, not MongoDB's _id (ObjectId)
  const order = await OrderModel.findOne({ orderId }).lean();
  if (!order) return null;
  const { _id, ...rest } = order as any;
  return { ...rest, id: _id.toString() };
};

export const updateOrder = async (orderId: string, data: any) => {
  await connectToDatabase();
  // orderId is a UUID string, not MongoDB's _id (ObjectId)
  const order = await OrderModel.findOneAndUpdate({ orderId }, data, { new: true }).lean();
  if (!order) return null;
  const { _id, ...rest } = order as any;
  return { ...rest, id: _id.toString() };
};

export const getAllOrders = async () => {
  await connectToDatabase();
  const orders = await OrderModel.find({})
    .sort({ createdAt: -1 }) // Sort by most recent first
    .lean();
  return orders.map((o: any) => {
    const { _id, ...rest } = o;
    return { ...rest, id: _id.toString() };
  });
};

import connectToDatabase from './mongodb';
import mongoose from 'mongoose';
// @ts-ignore
import { Product as ProductModel } from './models/Product';
// @ts-ignore
import { Store as StoreModel } from './models/Store';
// @ts-ignore
import { User as UserModel } from './models/User';
import { WalletTransaction } from './models/WalletTransaction';

export const creditVendorWalletsForOrder = async (
  orderId: string,
  options?: { paymentReference?: string; provider?: string; source?: string }
) => {
  await connectToDatabase();

  const order: any = await OrderModel.findOne({ orderId }).lean();
  if (!order) {
    return { success: false, reason: 'order_not_found', creditedVendors: 0, creditedStores: 0, totalCredited: 0 };
  }

  if (!['completed', 'released'].includes(String(order.paymentStatus || '').toLowerCase())) {
    return { success: false, reason: 'order_not_paid', creditedVendors: 0, creditedStores: 0, totalCredited: 0 };
  }

  const vendors = Array.isArray(order.vendors) ? order.vendors : [];
  let creditedVendors = 0;
  let creditedStores = 0;
  let totalCredited = 0;
  let skippedVendors = 0;

  for (const vendorEntry of vendors) {
    try {
      const vendorId = String(vendorEntry?.vendorId || '').trim();
      if (!vendorId) {
        skippedVendors += 1;
        continue;
      }

      const items = Array.isArray(vendorEntry?.items) ? vendorEntry.items : [];
      const entryTotal = typeof vendorEntry?.total === 'number'
        ? vendorEntry.total
        : items.reduce((sum: number, item: any) => {
            const unitPrice = Number(item?.price || 0);
            const quantity = Number(item?.quantity || 1);
            return sum + unitPrice * quantity;
          }, 0);

      const amount = Math.round(entryTotal * 100) / 100;
      if (!Number.isFinite(amount) || amount <= 0) {
        skippedVendors += 1;
        continue;
      }

      const storeIdFromEntry = vendorEntry?.storeId || items.find((item: any) => item?.storeId)?.storeId;
      let storeIdToCredit = storeIdFromEntry ? String(storeIdFromEntry) : '';

      let vendorStore: any = null;
      if (storeIdToCredit && mongoose.Types.ObjectId.isValid(storeIdToCredit)) {
        vendorStore = await StoreModel.findById(storeIdToCredit)
          .select('_id vendorId linkedWalletUserId')
          .lean();
      }

      if (!vendorStore) {
        vendorStore = await StoreModel.findOne({ vendorId })
          .sort({ createdAt: -1 })
          .select('_id vendorId linkedWalletUserId')
          .lean();
      }

      if (!storeIdToCredit && vendorStore?._id) {
        storeIdToCredit = String(vendorStore._id);
      }

      const walletUserIdCandidate = String(
        vendorStore?.linkedWalletUserId || vendorStore?.vendorId || vendorId || ''
      ).trim();
      const hasValidWalletUserId = mongoose.Types.ObjectId.isValid(walletUserIdCandidate);
      const walletUserId = hasValidWalletUserId ? walletUserIdCandidate : '';

      const reference = `vendor_order_credit_${orderId}_${vendorId}_${storeIdToCredit || 'nostore'}`;
      const paymentReference = options?.paymentReference || order.paymentReference;
      const provider = options?.provider || order?.paymentMethod || 'paystack';
      const source = options?.source || 'order_payment';

      const creditTx = await WalletTransaction.updateOne(
        { reference },
        {
          $setOnInsert: {
            userId: walletUserId || vendorId,
            type: 'vendor_credit',
            amount,
            status: 'completed',
            reference,
            paymentReference,
            provider,
            note: `Order payout for ${orderId}`,
            metadata: {
              source,
              orderId,
              vendorId,
              walletUserId: walletUserId || undefined,
            },
            orderId,
            storeId: storeIdToCredit || undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );

      if ((creditTx as any).upsertedCount === 0) {
        continue;
      }

      let creditedAny = false;

      if (walletUserId) {
        const vendorCreditResult = await UserModel.updateOne(
          { _id: walletUserId },
          {
            $inc: { walletBalance: amount },
            $set: { updatedAt: new Date() },
          }
        );

        if (vendorCreditResult.modifiedCount > 0) {
          creditedVendors += 1;
          creditedAny = true;
        } else {
          console.warn('[wallet-credit] Vendor wallet user not updated for order:', orderId, 'vendorId:', vendorId, 'walletUserId:', walletUserId);
        }
      } else {
        console.warn('[wallet-credit] Skipping vendor wallet update due to invalid vendor ID for order:', orderId, 'vendorId:', vendorId);
      }

      if (creditedAny) {
        totalCredited += amount;
      }
    } catch (vendorCreditError) {
      skippedVendors += 1;
      console.error('[wallet-credit] Failed to credit vendor entry for order:', orderId, vendorCreditError);
    }
  }

  return {
    success: true,
    creditedVendors,
    creditedStores,
    totalCredited,
    skippedVendors,
  };
};

export const releaseEscrowForOrder = async (
  orderId: string,
  options?: { paymentReference?: string; provider?: string; source?: string }
) => {
  await connectToDatabase();

  const order: any = await OrderModel.findOne({ orderId }).lean();
  if (!order) {
    return { success: false, reason: 'order_not_found' };
  }

  const paymentStatus = String(order.paymentStatus || '').toLowerCase();
  if (paymentStatus === 'released' || paymentStatus === 'completed') {
    return { success: true, reason: 'already_released' };
  }

  if (paymentStatus !== 'escrow') {
    return { success: false, reason: 'order_not_in_escrow' };
  }

  if (order.disputeRaisedAt || String(order.disputeStatus || '').toLowerCase() === 'active') {
    return { success: false, reason: 'order_disputed' };
  }

  const releaseUpdate = await OrderModel.updateOne(
    {
      orderId,
      paymentStatus: 'escrow',
      $and: [
        {
          $or: [
            { disputeRaisedAt: { $exists: false } },
            { disputeRaisedAt: null },
          ],
        },
        {
          $or: [
            { disputeStatus: { $exists: false } },
            { disputeStatus: null },
            { disputeStatus: { $ne: 'active' } },
          ],
        },
      ],
    },
    {
      $set: {
        paymentStatus: 'released',
        releasedAt: new Date(),
        updatedAt: new Date(),
      },
    }
  );

  if (releaseUpdate.modifiedCount === 0) {
    return { success: false, reason: 'release_condition_not_met' };
  }

  return await creditVendorWalletsForOrder(orderId, {
    paymentReference: options?.paymentReference || order.paymentReference,
    provider: options?.provider || order.paymentMethod,
    source: options?.source || 'escrow_release',
  });
};

export const getAllUsers = async () => {
  await connectToDatabase();
  const users = await UserModel.find({}).lean();
  return users.map((u: any) => {
    const { _id, ...rest } = u;
    return { ...rest, id: _id.toString() };
  });
};

// Service model definition (no separate file yet)
const ServiceSchema = new mongoose.Schema({
  providerId: { type: String, required: true },
  providerName: { type: String, required: true },
  providerImage: { type: String },
  title: { type: String, required: true },
  publicSlug: { type: String, unique: true, sparse: true, index: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  subcategory: { type: String },
  price: { type: Number, required: true },
  pricingType: { type: String, required: true },
  duration: { type: Number },
  packageOptions: {
    type: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
        description: { type: String, default: '' },
        price: { type: Number, required: true },
        duration: { type: Number },
        images: { type: [String], default: [] },
        attachments: { type: [mongoose.Schema.Types.Mixed], default: [] },
        pricingType: { type: String, default: 'fixed' },
        isDefault: { type: Boolean, default: false },
        active: { type: Boolean, default: true },
      },
    ],
    default: [],
  },
  addOnOptions: {
    type: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
        description: { type: String, default: '' },
        pricingType: { type: String, enum: ['fixed', 'percentage'], default: 'fixed' },
        amount: { type: Number, required: true },
        optional: { type: Boolean, default: true },
        active: { type: Boolean, default: true },
      },
    ],
    default: [],
  },
  requiresQuote: { type: Boolean, default: false },
  quoteNotesTemplate: { type: String, default: '' },
  quoteSlaHours: { type: Number, default: 24 },
  externalCalendarIcsUrl: { type: String, default: '' },
  calendarSyncEnabled: { type: Boolean, default: false },
  locationPricingRules: {
    type: [
      {
        id: { type: String, required: true },
        label: { type: String, required: true },
        matchType: { type: String, enum: ['state', 'city', 'contains'], default: 'contains' },
        matchValue: { type: String, required: true },
        fixedAdjustment: { type: Number, default: 0 },
        percentageAdjustment: { type: Number, default: 0 },
        active: { type: Boolean, default: true },
      },
    ],
    default: [],
  },
  distanceRatePerMile: { type: Number, default: 0 },
  rentalOptions: {
    type: {
      securityDeposit: { type: Number, default: 0 },
      mileageLimitPerDay: { type: Number, default: 0 },
      overtimeFeePerHour: { type: Number, default: 0 },
      minimumDriverAge: { type: Number, default: 21 },
      requiresDriverLicense: { type: Boolean, default: false },
    },
    default: null,
  },
  serviceSettings: {
    type: {
      advanceNoticeHours: { type: Number, default: 0 },
      cancellationWindowHours: { type: Number, default: 24 },
      maxBookingsPerDay: { type: Number, default: 0 },
    },
    default: null,
  },
  hospitalityDetails: {
    type: {
      propertyType: { type: String, enum: ['hotel', 'apartment', 'short-let-apartment', 'resort', 'guest-house'], default: 'hotel' },
      totalRooms: { type: Number, default: 0 },
      checkInTime: { type: String, default: '14:00' },
      checkOutTime: { type: String, default: '12:00' },
      maxAdvanceBookingDays: { type: Number, default: 365 },
      roomTypes: {
        type: [
          {
            id: { type: String, required: true },
            name: { type: String, required: true },
            description: { type: String, default: '' },
            pricePerNight: { type: Number, required: true },
            roomCount: { type: Number, default: 1 },
            maxGuests: { type: Number, default: 1 },
            maxAdults: { type: Number, default: 1 },
            maxChildren: { type: Number, default: 0 },
            bedType: { type: String, default: '' },
            amenities: { type: [String], default: [] },
            images: { type: [String], default: [] },
            isDefault: { type: Boolean, default: false },
            active: { type: Boolean, default: true },
          },
        ],
        default: [],
      },
    },
    default: null,
  },
  location: { type: String, required: true },
  state: { type: String, default: '' },
  city: { type: String, default: '' },
  locationType: { type: String, required: true },
  images: { type: [String], default: [] },
  availability: { type: mongoose.Schema.Types.Mixed, default: {} },
  featured: { type: Boolean, default: false },
  status: { type: String, default: 'active' },
  tags: { type: [String], default: [] },
}, { timestamps: true });

const ServiceModel = (mongoose.models.Service as any) || mongoose.model('Service', ServiceSchema);

const slugifyPublic = (value: string): string => {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const randomSlugSuffix = () => Math.random().toString(36).slice(2, 7)

const escapeRegex = (value: string): string => {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const generateUniquePublicSlug = async (
  model: any,
  baseLabel: string,
  excludeId?: string
): Promise<string> => {
  const baseSlug = slugifyPublic(baseLabel) || 'item'
  let candidate = baseSlug
  let attempts = 0

  while (attempts < 20) {
    const query: any = { publicSlug: candidate }
    if (excludeId && mongoose.Types.ObjectId.isValid(excludeId)) {
      query._id = { $ne: new mongoose.Types.ObjectId(excludeId) }
    }

    const exists = await model.exists(query)
    if (!exists) return candidate

    attempts += 1
    candidate = `${baseSlug}-${randomSlugSuffix()}`
  }

  return `${baseSlug}-${Date.now().toString(36)}`
}

const ensureStorePublicSlug = async (store: any): Promise<string> => {
  const existing = String(store?.publicSlug || '').trim()
  if (existing) return existing

  const storeId = String(store?._id || store?.id || '')
  const sourceName = String(store?.storeName || 'store')
  const publicSlug = await generateUniquePublicSlug(StoreModel, sourceName, storeId)

  if (storeId && mongoose.Types.ObjectId.isValid(storeId)) {
    await StoreModel.updateOne({ _id: new mongoose.Types.ObjectId(storeId) }, { $set: { publicSlug } })
  }

  return publicSlug
}

const ensureServicePublicSlug = async (service: any): Promise<string> => {
  const existing = String(service?.publicSlug || '').trim()
  if (existing) return existing

  const serviceId = String(service?._id || service?.id || '')
  const sourceName = String(service?.title || service?.name || 'service')
  const publicSlug = await generateUniquePublicSlug(ServiceModel, sourceName, serviceId)

  if (serviceId && mongoose.Types.ObjectId.isValid(serviceId)) {
    await ServiceModel.updateOne({ _id: new mongoose.Types.ObjectId(serviceId) }, { $set: { publicSlug } })
  }

  return publicSlug
}

const buildFallbackPackage = (service: any) => {
  const fallbackPrice = Number(service?.price || 0);
  const fallbackDuration = Number(service?.duration || 60);
  return {
    id: 'default',
    name: 'Standard',
    description: '',
    price: Number.isFinite(fallbackPrice) ? fallbackPrice : 0,
    duration: Number.isFinite(fallbackDuration) && fallbackDuration > 0 ? fallbackDuration : 60,
    pricingType: service?.pricingType || 'fixed',
    isDefault: true,
    active: true,
  };
};

const normalizeServicePricing = (service: any) => {
  const rawPackages = Array.isArray(service?.packageOptions) ? service.packageOptions : [];
  const activePackages = rawPackages.filter((pkg: any) => pkg && pkg.active !== false && Number(pkg.price) >= 0);
  const packageOptions = activePackages.length ? activePackages : [buildFallbackPackage(service)];
  const normalizedPackages = packageOptions.map((pkg: any) => ({
    ...pkg,
    images: Array.isArray(pkg?.images) ? pkg.images : [],
    attachments: Array.isArray(pkg?.attachments) ? pkg.attachments : [],
  }));

  const defaultPackage =
    normalizedPackages.find((pkg: any) => pkg.isDefault) ||
    normalizedPackages[0];

  const validPackagePrices = normalizedPackages
    .map((pkg: any) => Number(pkg.price || 0))
    .filter((value: number) => Number.isFinite(value) && value > 0);

  const fallbackPrice = Number(service?.price || 0);
  const normalizedPrice = validPackagePrices.length > 0
    ? Math.min(...validPackagePrices)
    : (Number.isFinite(fallbackPrice) && fallbackPrice > 0 ? fallbackPrice : 0);

  const primaryPackageImages = normalizedPackages
    .flatMap((pkg: any) => Array.isArray(pkg?.images) ? pkg.images : [])
    .filter((img: any) => typeof img === 'string' && img.trim());

  const normalizedImages = Array.isArray(service?.images) && service.images.length > 0
    ? service.images
    : (primaryPackageImages.length > 0 ? primaryPackageImages : (service?.providerImage ? [service.providerImage] : []));

  const normalizedHospitalityDetails = service?.hospitalityDetails && typeof service.hospitalityDetails === 'object'
    ? {
        ...service.hospitalityDetails,
        roomTypes: Array.isArray(service.hospitalityDetails.roomTypes)
          ? service.hospitalityDetails.roomTypes.map((room: any) => ({
              ...room,
              amenities: Array.isArray(room?.amenities) ? room.amenities : [],
              images: Array.isArray(room?.images) ? room.images : [],
            }))
          : [],
      }
    : null;

  return {
    ...service,
    images: normalizedImages,
    packageOptions: normalizedPackages,
    addOnOptions: Array.isArray(service?.addOnOptions) ? service.addOnOptions : [],
    requiresQuote: Boolean(service?.requiresQuote),
    quoteNotesTemplate: service?.quoteNotesTemplate || '',
    quoteSlaHours: Number(service?.quoteSlaHours) > 0 ? Number(service.quoteSlaHours) : 24,
    externalCalendarIcsUrl: service?.externalCalendarIcsUrl || '',
    calendarSyncEnabled: Boolean(service?.calendarSyncEnabled),
    locationPricingRules: Array.isArray(service?.locationPricingRules) ? service.locationPricingRules : [],
    distanceRatePerMile: Number.isFinite(Number(service?.distanceRatePerMile)) ? Number(service.distanceRatePerMile) : 0,
    rentalOptions: service?.rentalOptions && typeof service.rentalOptions === 'object' ? service.rentalOptions : null,
    serviceSettings: service?.serviceSettings && typeof service.serviceSettings === 'object' ? service.serviceSettings : null,
    hospitalityDetails: normalizedHospitalityDetails,
    defaultPackageId: defaultPackage?.id || normalizedPackages[0]?.id || 'default',
    price: normalizedPrice,
    pricingType: defaultPackage?.pricingType || service?.pricingType || 'fixed',
    duration: defaultPackage?.duration || service?.duration,
  };
};

// --- Store by ID ---
export const getStoreById = async (id: string) => {
  await connectToDatabase();
  try {
    let store: any = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      store = await StoreModel.findById(id).lean();
    }

    if (!store) {
      store = await StoreModel.findOne({ publicSlug: id }).lean();
    }

    if (!store && id) {
      const slugInput = String(id).trim().toLowerCase()
      const slugWithSpaces = slugInput.replace(/-/g, ' ')
      const slugTight = slugInput.replace(/-/g, '')
      const slugParts = slugInput.split('-').filter(Boolean)
      const partsPattern = slugParts.length
        ? `^\\s*${slugParts.map((part) => escapeRegex(part)).join('\\W*')}\\s*$`
        : ''

      store = await StoreModel.findOne({
        $or: [
          { storeName: new RegExp(`^${escapeRegex(slugInput)}$`, 'i') },
          { storeName: new RegExp(`^${escapeRegex(slugWithSpaces)}$`, 'i') },
          { storeName: new RegExp(`^${escapeRegex(slugTight)}$`, 'i') },
          ...(partsPattern ? [{ storeName: new RegExp(partsPattern, 'i') }] : []),
        ],
      }).lean()
    }

    if (!store) return null;

    if (!store.publicSlug) {
      const ensuredSlug = await ensureStorePublicSlug(store);
      return {
        ...store,
        publicSlug: ensuredSlug,
      };
    }

    return store;
  } catch (error) {
    console.error('getStoreById error:', error);
    return null;
  }
};

// --- Store by vendorId ---
export const getStoreByVendorId = async (vendorId: string) => {
  await connectToDatabase();
  try {
    return await StoreModel.findOne({ vendorId }).lean();
  } catch (error) {
    console.error('getStoreByVendorId error:', error);
    return null;
  }
};

export const getAllStores = async () => {
  await connectToDatabase();
  const stores = await StoreModel.find({}).lean();
  return stores.map((s: any) => {
    const { _id, ...rest } = s;
    return { ...rest, id: _id.toString() };
  });
};

export const getAllProducts = async () => {
  await connectToDatabase();
  const products = await ProductModel.find({}).lean();
  return products.map((p: any) => {
    const { _id, ...rest } = p;
    return { ...rest, id: _id.toString() };
  });
};

// --- User by ID ---
export const getUserById = async (id: string) => {
  await connectToDatabase();
  try {
    // Check if id is a valid MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    return await UserModel.findById(id).lean();
  } catch (error) {
    console.error('getUserById error:', error);
    return null;
  }
};

// --- Update Store ---
export const updateStore = async (id: string, data: any) => {
  await connectToDatabase();
  return StoreModel.findByIdAndUpdate(id, data, { new: true }).lean();
};

export const createProduct = async (productData: any): Promise<string> => {
  await connectToDatabase();
  const product: any = await ProductModel.create(productData as any);
  return product?._id?.toString?.() || '';
};

export const getVendorProducts = async (vendorId: string) => {
  await connectToDatabase();
  const products = await ProductModel.find({ vendorId }).lean();
  // Map _id to id for compatibility
  return products.map((p: any) => {
    const { _id, ...rest } = p;
    return {
      ...rest,
      id: _id.toString(),
    };
  });
};

export const getProductById = async (id: string) => {
  await connectToDatabase();
  const product = await ProductModel.findById(id).lean();
  if (!product) return null;
  const { _id, ...rest } = product as any;
  return { ...rest, id: _id.toString() };
};

export const createService = async (serviceData: any): Promise<any> => {
  await connectToDatabase();
  const hospitalityRoomTypes = Array.isArray(serviceData?.hospitalityDetails?.roomTypes)
    ? serviceData.hospitalityDetails.roomTypes.filter((room: any) => room && room.name && Number(room.pricePerNight) >= 0)
    : [];

  const derivedHospitalityPackages = hospitalityRoomTypes.map((room: any) => ({
    id: room.id,
    name: room.name,
    description: room.description || '',
    price: Number(room.pricePerNight || 0),
    duration: 1440,
    pricingType: 'fixed',
    isDefault: Boolean(room.isDefault),
    active: room.active !== false,
    images: Array.isArray(room.images) ? room.images : [],
  }));

  const packageOptions = Array.isArray(serviceData?.packageOptions)
    ? serviceData.packageOptions.filter((pkg: any) => pkg && pkg.name && Number(pkg.price) >= 0)
    : (derivedHospitalityPackages.length > 0 ? derivedHospitalityPackages : []);

  const normalizedInput = {
    ...serviceData,
    publicSlug: serviceData?.publicSlug,
    packageOptions,
    addOnOptions: Array.isArray(serviceData?.addOnOptions) ? serviceData.addOnOptions : [],
    requiresQuote: Boolean(serviceData?.requiresQuote),
    quoteNotesTemplate: serviceData?.quoteNotesTemplate || '',
  } as any;

  if (packageOptions.length > 0) {
    const minPrice = Math.min(...packageOptions.map((pkg: any) => Number(pkg.price || 0)));
    normalizedInput.price = Number.isFinite(minPrice) ? minPrice : Number(serviceData?.price || 0);
    if (!normalizedInput.pricingType) {
      normalizedInput.pricingType = packageOptions.find((pkg: any) => pkg.isDefault)?.pricingType || 'fixed';
    }
  }

  if (!normalizedInput.publicSlug) {
    normalizedInput.publicSlug = await generateUniquePublicSlug(
      ServiceModel,
      String(normalizedInput.title || normalizedInput.name || 'service')
    );
  }

  const service: any = await ServiceModel.create(normalizedInput as any);
  if (!service) return null;
  const { _id, ...rest } = service.toObject ? service.toObject() : (service as any);
  const result = normalizeServicePricing({ ...rest, id: _id?.toString?.() });
  console.log(`[createService] Created service with id: ${result.id}`, result);
  return result;
};

export const getServiceById = async (id: string) => {
  await connectToDatabase();
  try {
    let service: any = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      service = await ServiceModel.findById(id).lean();
    }

    if (!service) {
      service = await ServiceModel.findOne({ publicSlug: id }).lean();
    }

    if (!service && id) {
      const slugInput = String(id).trim().toLowerCase()
      const slugWithSpaces = slugInput.replace(/-/g, ' ')
      const slugTight = slugInput.replace(/-/g, '')

      service = await ServiceModel.findOne({
        $or: [
          { title: new RegExp(`^${escapeRegex(slugInput)}$`, 'i') },
          { title: new RegExp(`^${escapeRegex(slugWithSpaces)}$`, 'i') },
          { title: new RegExp(`^${escapeRegex(slugTight)}$`, 'i') },
        ],
      }).lean()
    }

    if (!service) {
      console.log(`[getServiceById] Service not found for id: ${id}`);
      return null;
    }

    let serviceWithSlug = service;
    if (!service.publicSlug) {
      const ensuredSlug = await ensureServicePublicSlug(service);
      serviceWithSlug = {
        ...service,
        publicSlug: ensuredSlug,
      };
    }

    const { _id, ...rest } = serviceWithSlug as any;
    const result = normalizeServicePricing({ ...rest, id: _id.toString() });
    console.log(`[getServiceById] Found service:`, result);
    return result;
  } catch (error: any) {
    console.error(`[getServiceById] Error fetching service ${id}:`, error.message);
    return null;
  }
};

export const updateService = async (id: string, data: any) => {
  await connectToDatabase();
  const service = await ServiceModel.findByIdAndUpdate(id, data, { new: true }).lean();
  if (!service) return null;
  const { _id, ...rest } = service as any;
  return { ...rest, id: _id.toString() };
};

export const deleteService = async (id: string) => {
  await connectToDatabase();
  await ServiceModel.findByIdAndDelete(id);
  return true;
};
// --- Store Creation (Real) ---
export const createStore = async (storeData: any): Promise<string> => {
  await connectToDatabase();
  const preparedStoreData = {
    ...storeData,
    publicSlug: storeData?.publicSlug,
  } as any;

  if (!preparedStoreData.publicSlug) {
    preparedStoreData.publicSlug = await generateUniquePublicSlug(
      StoreModel,
      String(preparedStoreData.storeName || preparedStoreData.name || 'store')
    );
  }

  const store: any = await StoreModel.create(preparedStoreData as any);
  return store?._id?.toString?.() || '';
};
// --- Store Operations ---
// --- Store Operations (Real) ---
export const getStores = async (filters: any) => {
  await connectToDatabase();
  const query: any = {};
  if (filters?.category) query.category = filters.category;
  if (filters?.isOpen !== undefined) query.isOpen = filters.isOpen;
  if (filters?.vendorId) query.vendorId = filters.vendorId;
  if (filters?.isActive !== undefined) query.isActive = filters.isActive;
  let dbQuery = StoreModel.find(query);
  if (filters?.limitCount) {
    dbQuery = dbQuery.limit(Number(filters.limitCount));
  }
  const stores = await dbQuery.lean();
  return await Promise.all(stores.map(async (store: any) => {
    if (store?.publicSlug) return store;
    const publicSlug = await ensureStorePublicSlug(store);
    return {
      ...store,
      publicSlug,
    };
  }));
};
// --- Vendor Dashboard Operations ---
export const getOrdersByVendor = async (vendorId: string) => {
  await connectToDatabase();
  // Query orders where the vendor is in the vendors array
  const orders = await OrderModel.find({
    'vendors.vendorId': vendorId
  })
  .sort({ createdAt: -1 }) // Sort by most recent first
  .lean();
  return orders.map((o: any) => {
    const { _id, ...rest } = o;
    return { ...rest, id: _id.toString() };
  });
};


// Mock implementation for getServices (replace with real MongoDB logic)
export interface Service {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  providerId: string;
  providerImage?: string;
  state?: string;
  city?: string;
  featured: boolean;
  locationType: 'remote' | 'local';
  price: number;
  pricingType?: 'fixed' | 'hourly' | 'per-session' | 'custom' | string;
  duration?: number;
  packageOptions?: Array<{
    id: string;
    name: string;
    description?: string;
    price: number;
    duration?: number;
    images?: string[];
    pricingType?: string;
    isDefault?: boolean;
    active?: boolean;
  }>;
  addOnOptions?: Array<{
    id: string;
    name: string;
    description?: string;
    pricingType: 'fixed' | 'percentage' | string;
    amount: number;
    optional?: boolean;
    active?: boolean;
  }>;
  requiresQuote?: boolean;
  quoteNotesTemplate?: string;
  quoteSlaHours?: number;
  externalCalendarIcsUrl?: string;
  calendarSyncEnabled?: boolean;
  locationPricingRules?: Array<{
    id: string;
    label: string;
    matchType: 'state' | 'city' | 'contains';
    matchValue: string;
    fixedAdjustment?: number;
    percentageAdjustment?: number;
    active?: boolean;
  }>;
  distanceRatePerMile?: number;
  hospitalityDetails?: {
    propertyType?: 'hotel' | 'apartment' | 'short-let-apartment' | 'resort' | 'guest-house';
    totalRooms?: number;
    checkInTime?: string;
    checkOutTime?: string;
    maxAdvanceBookingDays?: number;
    roomTypes?: Array<{
      id: string;
      name: string;
      description?: string;
      pricePerNight: number;
      roomCount?: number;
      maxGuests?: number;
      maxAdults?: number;
      maxChildren?: number;
      bedType?: string;
      amenities?: string[];
      images?: string[];
      isDefault?: boolean;
      active?: boolean;
    }>;
  } | null;
  rating: number;
  reviews: number;
}

export interface ServiceFilters {
  [key: string]: any;
}

export const getServices = async (filters: ServiceFilters): Promise<Service[]> => {
  await connectToDatabase();
  const query: any = {};
  if (filters?.category) query.category = filters.category;
  if (filters?.providerId) query.providerId = filters.providerId;
  if (filters?.featured !== undefined) query.featured = filters.featured;
  if (filters?.locationType) query.locationType = filters.locationType;
  if (filters?.search) {
    const searchRegex = new RegExp(String(filters.search).trim(), 'i');
    query.$or = [
      { title: searchRegex },
      { description: searchRegex },
      { category: searchRegex },
      { subcategory: searchRegex },
      { providerName: searchRegex },
      { location: searchRegex },
      { state: searchRegex },
      { city: searchRegex },
      { tags: searchRegex },
    ];
  }

  let q = ServiceModel.find(query).sort({ createdAt: -1 });
  if (filters?.limitCount) q = q.limit(Number(filters.limitCount));

  const services = await q.lean();
  const servicesWithPublicSlugs = await Promise.all(services.map(async (service: any) => {
    if (service?.publicSlug) return service;
    const publicSlug = await ensureServicePublicSlug(service);
    return {
      ...service,
      publicSlug,
    };
  }));

  return servicesWithPublicSlugs.map((s: any) => {
    const { _id, ...rest } = s;
    return normalizeServicePricing({ ...rest, id: _id.toString() }) as Service;
  });
};

// FINAL STUB EXPORTS ONLY
export interface Product {
  id: string;
  vendorId: string;
  vendorName?: string;
  name?: string;
  title?: string;
  description?: string;
  price?: number;
  category?: string;
  subcategory?: string;
  images?: string[];
  productDocuments?: string[];
  stock?: number;
  sku?: string;
  featured?: boolean;
  status?: string;
  sales?: number;
  hasColorOptions?: boolean;
  hasSizeOptions?: boolean;
  colors?: string[];
  sizes?: string[];
  colorImages?: { [key: string]: string };
  createdAt?: string;
  updatedAt?: string;
}

const buildProductQuery = (filters?: any) => {
  const query: any = {};
  if (filters?.category) query.category = new RegExp(`^${filters.category}$`, 'i');
  if (filters?.vendorId) query.vendorId = filters.vendorId;
  if (filters?.featured !== undefined) query.featured = filters.featured;
  if (filters?.status) query.status = filters.status;

  const minPrice = Number(filters?.minPrice);
  const maxPrice = Number(filters?.maxPrice);
  if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
    query.price = {};
    if (Number.isFinite(minPrice)) query.price.$gte = minPrice;
    if (Number.isFinite(maxPrice)) query.price.$lte = maxPrice;
  }

  if (filters?.search) {
    const searchRegex = new RegExp(String(filters.search).trim(), 'i');
    query.$or = [
      { title: searchRegex },
      { name: searchRegex },
      { description: searchRegex },
      { category: searchRegex },
      { subcategory: searchRegex },
      { tags: searchRegex },
      { vendorName: searchRegex },
    ];
  }

  return query;
};

const getProductSort = (sortBy?: string): Record<string, 1 | -1> => {
  switch (String(sortBy || 'featured')) {
    case 'price-low':
      return { price: 1, createdAt: -1 };
    case 'price-high':
      return { price: -1, createdAt: -1 };
    case 'popular':
      return { sales: -1, createdAt: -1 };
    case 'name':
      return { name: 1, createdAt: -1 };
    case 'newest':
      return { createdAt: -1 };
    case 'featured':
    default:
      return { featured: -1, createdAt: -1 };
  }
};

export const countProducts = async (filters?: any): Promise<number> => {
  await connectToDatabase();
  const query = buildProductQuery(filters);
  return ProductModel.countDocuments(query);
};

export const getProducts = async (filters?: any): Promise<Product[]> => {
  await connectToDatabase();
  const query = buildProductQuery(filters);
  const limitCount = Number(filters?.limitCount);
  const skipCount = Number(filters?.skipCount || 0);
  const hasLimit = Number.isFinite(limitCount) && limitCount > 0;
  const hasSkip = Number.isFinite(skipCount) && skipCount > 0;

  const mapProduct = (p: any) => ({
    ...p,
    id: p._id?.toString() || p.id,
    name: p.name || p.title || '',
  });

  let dbQuery = ProductModel.find(query).sort(getProductSort(filters?.sortBy));
  if (hasSkip) dbQuery = dbQuery.skip(skipCount);
  if (hasLimit) dbQuery = dbQuery.limit(limitCount);

  const products = await dbQuery.lean();
  return products.map(mapProduct);
};

export const updateProduct = async (id: string, data: any) => {
  await connectToDatabase();
  const product = await ProductModel.findByIdAndUpdate(id, data, { new: true }).lean();
  if (!product) return null;
  const { _id, ...rest } = product as any;
  return { ...rest, id: _id.toString() };
};

export const deleteProduct = async (id: string) => {
  await connectToDatabase();
  await ProductModel.findByIdAndDelete(id);
  return true;
};

export const getVendors = () => { throw new Error("Server-only: getVendors is not available on client."); };
export const getOrders = async (filters: any) => {
  await connectToDatabase();
  const query: any = {};
  if (filters?.customerId) query.customerId = filters.customerId;
  if (filters?.vendorId) query.vendors = { $elemMatch: { vendorId: filters.vendorId } };
  if (filters?.status) query.status = filters.status;
  const orders = await OrderModel.find(query)
    .sort({ createdAt: -1 }) // Sort by most recent first
    .lean();
  return orders.map((o: any) => {
    const { _id, ...rest } = o;
    return { ...rest, id: _id.toString() };
  });
};

// --- User Cart Operations ---
// @ts-ignore
import { Cart as CartModel } from './models/Cart';
// @ts-ignore
import { Booking as BookingModel } from './models/Booking';

export const getUserCart = async (userId: string) => {
  await connectToDatabase();
  const cart: any = await CartModel.findOne({ userId }).lean();
  return cart || { userId, items: [] };
};

export const setUserCart = async (userId: string, items: any[]) => {
  await connectToDatabase();
  await CartModel.findOneAndUpdate(
    { userId },
    { $set: { items } },
    { upsert: true, new: true }
  );
  return true;
};
export const updateUserProfileInDb = async (userId: string, data: any) => {
  await connectToDatabase();

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return { success: false, error: 'Invalid user ID' };
  }

  const result = await UserModel.findByIdAndUpdate(
    userId,
    {
      ...data,
      updatedAt: new Date(),
    },
    { new: true }
  ).lean();

  if (!result) {
    return { success: false, error: 'User not found' };
  }

  return { success: true, data: result };
};
export const deleteStore = async (id: string) => {
  await connectToDatabase();
  if (mongoose.Types.ObjectId.isValid(id)) {
    await StoreModel.findByIdAndDelete(id);
  } else {
    await StoreModel.deleteMany({ vendorId: id });
  }
  return true;
};
export const deleteProductsByVendor = async (vendorId: string) => {
  await connectToDatabase();
  await ProductModel.deleteMany({ vendorId });
  return true;
};
export const deleteServicesByVendor = async (vendorId: string) => {
  await connectToDatabase();
  await ServiceModel.deleteMany({ $or: [{ providerId: vendorId }, { vendorId }] });
  return true;
};
export const deleteOrdersByVendor = async (vendorId: string) => {
  await connectToDatabase();
  await OrderModel.updateMany(
    { 'vendors.vendorId': vendorId },
    {
      $set: {
        'vendors.$[elem].status': 'cancelled',
        'vendors.$[elem].cancelledAt': new Date(),
        updatedAt: new Date(),
      },
    },
    { arrayFilters: [{ 'elem.vendorId': vendorId }] }
  );
  return true;
};

export const getBookings = async (filters: any) => {
  await connectToDatabase();
  const query: any = {};
  if (filters?.customerId) query.customerId = filters.customerId;
  if (filters?.providerId) query.providerId = filters.providerId;
  if (filters?.status) query.status = filters.status;
  
  const bookings = await BookingModel.find(query).sort({ bookingDate: -1 }).lean();
  return bookings.map((b: any) => {
    const { _id, ...rest } = b;
    return { ...rest, id: _id.toString() };
  });
};

export const getBookingsByCustomer = async (customerId: string) => {
  await connectToDatabase();
  const bookings = await BookingModel.find({ customerId }).sort({ bookingDate: -1 }).lean();
  return bookings.map((b: any) => {
    const { _id, ...rest } = b;
    return { ...rest, id: _id.toString() };
  });
};

export const getBookingsByProvider = async (providerId: string) => {
  await connectToDatabase();
  const bookings = await BookingModel.find({ providerId }).sort({ bookingDate: -1 }).lean();
  return bookings.map((b: any) => {
    const { _id, ...rest } = b;
    return { ...rest, id: _id.toString() };
  });
};

export const getAllBookings = async () => {
  await connectToDatabase();
  const bookings = await BookingModel.find({}).sort({ bookingDate: -1 }).lean();
  return bookings.map((b: any) => {
    const { _id, ...rest } = b;
    return { ...rest, id: _id.toString() };
  });
};

export const createBooking = async (bookingData: any) => {
  await connectToDatabase();
  const booking: any = await BookingModel.create(bookingData as any);
  if (!booking) return null;
  const { _id, ...rest } = booking.toObject ? booking.toObject() : (booking as any);
  const result = { ...rest, id: _id?.toString?.() };
  console.log(`[createBooking] Created booking with id: ${result.id}`);
  return result;
};

export const getConversations = async (userId: string, role: 'customer' | 'provider') => {
  await connectToDatabase();
  // Fetch conversations where user is either customer or provider
  const conversations = await ConversationModel.find({
    $or: [
      { customerId: userId },
      { providerId: userId }
    ]
  }).sort({ lastMessageTime: -1 }).lean();
  return conversations.map((c: any) => ({ ...c, id: c._id.toString() }));
};

export const getChatMessages = async (conversationId: string, limitCount?: number, userId?: string, userRole?: string) => {
  await connectToDatabase();
  const filter = { conversationId };
  let query = MessageModel.find(filter).sort({ createdAt: 1 });
  if (limitCount) query = query.limit(limitCount);
  const messages = await query.lean();
  // Only reset unreadCount for the recipient (userId and userRole must be provided)
  if (userId && userRole) {
    if (userRole === 'customer') {
      await ConversationModel.findByIdAndUpdate(conversationId, { customerUnreadCount: 0 });
      console.log(`[getChatMessages] Reset customerUnreadCount for conversation ${conversationId} by user ${userId}`);
    } else if (userRole === 'provider') {
      await ConversationModel.findByIdAndUpdate(conversationId, { providerUnreadCount: 0 });
      console.log(`[getChatMessages] Reset providerUnreadCount for conversation ${conversationId} by user ${userId}`);
    }
    // Log the updated conversation
    const updatedConv = await ConversationModel.findById(conversationId);
    if (updatedConv) {
      console.log('[getChatMessages] Updated conversation unread counts:', {
        customerUnreadCount: updatedConv.customerUnreadCount,
        providerUnreadCount: updatedConv.providerUnreadCount
      });
    }
  }
  return messages.map((m: any) => ({ ...m, id: m._id.toString() }));
};

export const createChatMessage = async (data: any) => {
  await connectToDatabase();
  // Find or create conversation
  let conversation = null;
  if (data.conversationId) {
    conversation = await ConversationModel.findById(data.conversationId);
  }
  if (!conversation) {
    // If conversationId is not found, create a new conversation
    const isCustomerSender = data.senderRole === 'customer';
    conversation = await ConversationModel.create({
      customerId: isCustomerSender ? data.senderId : data.receiverId,
      customerName: isCustomerSender ? data.senderName : data.receiverName || '',
      providerId: isCustomerSender ? data.receiverId : data.senderId,
      providerName: isCustomerSender ? data.receiverName : data.senderName || '',
      lastMessage: data.message,
      lastMessageTime: new Date(),
      customerUnreadCount: isCustomerSender ? 0 : 1,
      providerUnreadCount: isCustomerSender ? 1 : 0,
    });
    console.log('[createChatMessage] New conversation created:', {
      customerId: conversation.customerId,
      providerId: conversation.providerId,
      customerUnreadCount: conversation.customerUnreadCount,
      providerUnreadCount: conversation.providerUnreadCount
    });
  } else {
    // Update conversation preview
    conversation.lastMessage = data.message;
    conversation.lastMessageTime = new Date();
    // Increment unreadCount for the recipient only
    if (data.senderRole === 'customer') {
      conversation.providerUnreadCount = (conversation.providerUnreadCount || 0) + 1;
      console.log('[createChatMessage] Incremented providerUnreadCount:', conversation.providerUnreadCount);
    } else {
      conversation.customerUnreadCount = (conversation.customerUnreadCount || 0) + 1;
      console.log('[createChatMessage] Incremented customerUnreadCount:', conversation.customerUnreadCount);
    }
    await conversation.save();
    console.log('[createChatMessage] After save:', {
      customerId: conversation.customerId,
      providerId: conversation.providerId,
      customerUnreadCount: conversation.customerUnreadCount,
      providerUnreadCount: conversation.providerUnreadCount
    });
  }
  // Save message
  const message = await MessageModel.create({
    ...data,
    conversationId: conversation._id,
    createdAt: new Date(),
  }) as any;
  return (message as any)._id.toString();
};

export const createConversation = async (data: any) => {
  await connectToDatabase();
  const conversation = await ConversationModel.create({
    customerId: data.customerId,
    customerName: data.customerName,
    providerId: data.providerId,
    providerName: data.providerName,
    storeImage: data.storeImage,
    storeName: data.storeName,
    lastMessage: data.lastMessage,
    lastMessageTime: data.lastMessageTime ? new Date(data.lastMessageTime) : new Date(),
    unreadCount: data.unreadCount || 0,
  });
  return conversation;
};

export const deleteBookingsByVendor = async (vendorId: string) => {
  await connectToDatabase();
  await BookingModel.deleteMany({ providerId: vendorId });
  return true;
};
export const deleteUserCartItemsByVendor = async (vendorId: string) => {
  await connectToDatabase();
  await CartModel.updateMany(
    {},
    {
      $pull: {
        items: {
          $or: [{ vendorId }, { providerId: vendorId }],
        },
      },
    }
  );
  return true;
};
export const deleteConversationsByVendor = async (vendorId: string) => {
  await connectToDatabase();
  const conversations = await ConversationModel.find({ providerId: vendorId }).select('_id').lean();
  const conversationIds = conversations.map((conversation: any) => conversation._id);

  if (conversationIds.length > 0) {
    await MessageModel.deleteMany({ conversationId: { $in: conversationIds } });
  }

  await ConversationModel.deleteMany({ providerId: vendorId });
  return true;
};
export const deleteUser = async (userId: string) => {
  await connectToDatabase();
  await UserModel.findByIdAndDelete(userId);
  return true;
};
export const deleteSessions = async (userId: string) => {
  await connectToDatabase();
  await UserModel.findByIdAndUpdate(userId, { $unset: { sessionToken: 1 }, $set: { updatedAt: new Date() } });
  return true;
};