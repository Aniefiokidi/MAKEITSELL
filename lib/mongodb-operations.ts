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

  if (order.paymentStatus !== 'completed') {
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

      const reference = `vendor_order_credit_${orderId}_${vendorId}`;
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
          { _id: walletUserId, role: 'vendor' },
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

      if (storeIdToCredit && mongoose.Types.ObjectId.isValid(storeIdToCredit)) {
        const storeQuery: any = { _id: storeIdToCredit };
        if (vendorStore?.vendorId) {
          storeQuery.vendorId = String(vendorStore.vendorId);
        }

        const storeUpdateSet: any = { updatedAt: new Date() };
        if (walletUserId) {
          storeUpdateSet.linkedWalletUserId = walletUserId;
        }

        const storeResult = await StoreModel.updateOne(
          storeQuery,
          {
            $inc: { walletBalance: amount },
            $set: storeUpdateSet,
          }
        );

        if (storeResult.modifiedCount > 0) {
          creditedStores += 1;
          creditedAny = true;
        }
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
  }));

  const defaultPackage =
    normalizedPackages.find((pkg: any) => pkg.isDefault) ||
    normalizedPackages[0];

  const minPrice = Math.min(...normalizedPackages.map((pkg: any) => Number(pkg.price || 0)));
  const normalizedPrice = Number.isFinite(minPrice) ? minPrice : Number(service?.price || 0) || 0;

  return {
    ...service,
    packageOptions: normalizedPackages,
    addOnOptions: Array.isArray(service?.addOnOptions) ? service.addOnOptions : [],
    requiresQuote: Boolean(service?.requiresQuote),
    quoteNotesTemplate: service?.quoteNotesTemplate || '',
    quoteSlaHours: Number(service?.quoteSlaHours) > 0 ? Number(service.quoteSlaHours) : 24,
    externalCalendarIcsUrl: service?.externalCalendarIcsUrl || '',
    calendarSyncEnabled: Boolean(service?.calendarSyncEnabled),
    locationPricingRules: Array.isArray(service?.locationPricingRules) ? service.locationPricingRules : [],
    distanceRatePerMile: Number.isFinite(Number(service?.distanceRatePerMile)) ? Number(service.distanceRatePerMile) : 0,
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
    // Check if id is a valid MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    return await StoreModel.findById(id).lean();
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
  const packageOptions = Array.isArray(serviceData?.packageOptions)
    ? serviceData.packageOptions.filter((pkg: any) => pkg && pkg.name && Number(pkg.price) >= 0)
    : [];

  const normalizedInput = {
    ...serviceData,
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
    // Validate that id looks like a MongoDB ObjectId
    const service = await ServiceModel.findById(id).lean();
    if (!service) {
      console.log(`[getServiceById] Service not found for id: ${id}`);
      return null;
    }
    const { _id, ...rest } = service as any;
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
  const store: any = await StoreModel.create(storeData as any);
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
  return stores;
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
  return services.map((s: any) => {
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

export const getProducts = async (filters?: any): Promise<Product[]> => {
  await connectToDatabase();
  const query: any = {};
  if (filters?.category) query.category = new RegExp(`^${filters.category}$`, 'i');
  if (filters?.vendorId) query.vendorId = filters.vendorId;
  if (filters?.featured !== undefined) query.featured = filters.featured;
  if (filters?.status) query.status = filters.status;
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
  const limitCount = Number(filters?.limitCount);
  const skipCount = Number(filters?.skipCount || 0);
  const hasLimit = Number.isFinite(limitCount) && limitCount > 0;
  const hasSkip = Number.isFinite(skipCount) && skipCount > 0;

  const mapProduct = (p: any) => ({
    ...p,
    id: p._id?.toString() || p.id,
    name: p.name || p.title || '',
  });

  let dbQuery = ProductModel.find(query).sort({ createdAt: -1 });
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