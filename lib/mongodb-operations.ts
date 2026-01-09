import { Order as OrderModel } from './models/Order';
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

import connectToDatabase from './mongodb';
// @ts-ignore
import { Product as ProductModel } from './models/Product';
// @ts-ignore
import { Store as StoreModel } from './models/Store';
// @ts-ignore
import { User as UserModel } from './models/User';

// --- Store by ID ---
export const getStoreById = async (id: string) => {
  await connectToDatabase();
  return StoreModel.findById(id).lean();
};

// --- User by ID ---
export const getUserById = async (id: string) => {
  await connectToDatabase();
  return UserModel.findById(id).lean();
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
  const stores = await StoreModel.find(query)
    .limit(filters?.limitCount ? Number(filters.limitCount) : 20)
    .lean();
  return stores;
};
// --- Vendor Dashboard Operations ---
export const getOrdersByVendor = async (vendorId: string) => {
	// TODO: Replace with real MongoDB logic
	return [];
};


// Mock implementation for getServices (replace with real MongoDB logic)
export interface Service {
  id: string;
  name: string;
  category: string;
  providerId: string;
  featured: boolean;
  locationType: 'remote' | 'local';
  price: number;
  rating: number;
  reviews: number;
}

export interface ServiceFilters {
  [key: string]: any;
}

export const getServices = async (filters: ServiceFilters): Promise<Service[]> => {
  // TODO: Replace with real MongoDB query for services
  return [];
};

// FINAL STUB EXPORTS ONLY
export interface Product {
  id: string;
  vendorId: string;
  images?: string[];
}

export const getProducts = async (filters?: any): Promise<Product[]> => {
  await connectToDatabase();
  const query: any = {};
  if (filters?.category) query.category = filters.category;
  if (filters?.vendorId) query.vendorId = filters.vendorId;
  if (filters?.featured !== undefined) query.featured = filters.featured;
  if (filters?.status) query.status = filters.status;
  const mapProduct = (p: any) => ({
    ...p,
    id: p._id?.toString() || p.id,
    name: p.name || p.title || '',
  });
  if (filters?.limitCount) {
    const products = await ProductModel.find(query).limit(Number(filters.limitCount)).lean();
    return products.map(mapProduct);
  } else {
    const products = await ProductModel.find(query).lean();
    return products.map(mapProduct);
  }
};
export const updateProduct = () => { throw new Error("Server-only: updateProduct is not available on client."); };
export const deleteProduct = () => { throw new Error("Server-only: deleteProduct is not available on client."); };
export const getVendors = () => { throw new Error("Server-only: getVendors is not available on client."); };
export const getOrders = async (filters: any) => {
  await connectToDatabase();
  const query: any = {};
  if (filters?.customerId) query.customerId = filters.customerId;
  if (filters?.vendorId) query.vendors = { $elemMatch: { vendorId: filters.vendorId } };
  if (filters?.status) query.status = filters.status;
  const orders = await OrderModel.find(query).lean();
  return orders.map((o: any) => {
    const { _id, ...rest } = o;
    return { ...rest, id: _id.toString() };
  });
};

// --- User Cart Operations ---
// @ts-ignore
import { Cart as CartModel } from './models/Cart';

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
export const updateUserProfileInDb = () => { throw new Error("Server-only: updateUserProfileInDb is not available on client."); };
export const deleteStore = () => { throw new Error("Server-only: deleteStore is not available on client."); };
export const deleteProductsByVendor = () => { throw new Error("Server-only: deleteProductsByVendor is not available on client."); };
export const deleteServicesByVendor = () => { throw new Error("Server-only: deleteServicesByVendor is not available on client."); };
export const deleteOrdersByVendor = () => { throw new Error("Server-only: deleteOrdersByVendor is not available on client."); };

export const getBookings = async (filters: any) => {
  // TODO: Implement bookings from MongoDB when Booking model is created
  return [];
};

export const deleteBookingsByVendor = () => { throw new Error("Server-only: deleteBookingsByVendor is not available on client."); };
export const deleteUserCartItemsByVendor = () => { throw new Error("Server-only: deleteUserCartItemsByVendor is not available on client."); };
export const deleteConversationsByVendor = () => { throw new Error("Server-only: deleteConversationsByVendor is not available on client."); };
export const deleteUser = () => { throw new Error("Server-only: deleteUser is not available on client."); };
export const deleteSessions = () => { throw new Error("Server-only: deleteSessions is not available on client."); };