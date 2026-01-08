
import connectToDatabase from './mongodb';
import { Product as ProductModel } from './models/Product';
import { Store as StoreModel } from './models/Store';
import type { Document } from 'mongoose';

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

// --- Store Creation (Real) ---
export const createStore = async (storeData: any): Promise<string> => {
  await connectToDatabase();
  const store = await StoreModel.create(storeData) as Document & { _id: any };
  return store._id.toString();
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
  // Example mock data
  return [
    {
      id: 'service1',
      name: 'Web Design',
      category: 'Design',
      providerId: 'vendor1',
      featured: true,
      locationType: 'remote',
      price: 50000,
      rating: 4.8,
      reviews: 120
    },
    {
      id: 'service2',
      name: 'Logo Creation',
      category: 'Design',
      providerId: 'vendor2',
      featured: false,
      locationType: 'local',
      price: 20000,
      rating: 4.5,
      reviews: 80
    }
  ];
};

// FINAL STUB EXPORTS ONLY
export interface Product {
  id: string;
  vendorId: string;
  images?: string[];
}

export const getProducts = async (filters?: any): Promise<Product[]> => {
  // Mock implementation: return a fake product array
  return [
    {
      id: 'product1',
      vendorId: filters?.vendorId || 'vendor1',
      images: ['/images/demo-product1.png']
    },
    {
      id: 'product2',
      vendorId: filters?.vendorId || 'vendor1',
      images: ['/images/demo-product2.png']
    }
  ];
};
export const createProduct = () => { throw new Error("Server-only: createProduct is not available on client."); };
export const updateProduct = () => { throw new Error("Server-only: updateProduct is not available on client."); };
export const deleteProduct = () => { throw new Error("Server-only: deleteProduct is not available on client."); };
export const getVendors = () => { throw new Error("Server-only: getVendors is not available on client."); };
export const getOrders = () => { throw new Error("Server-only: getOrders is not available on client."); };

export const getUserCart = () => { throw new Error("Server-only: getUserCart is not available on client."); };
export const updateUserProfileInDb = () => { throw new Error("Server-only: updateUserProfileInDb is not available on client."); };
export const deleteStore = () => { throw new Error("Server-only: deleteStore is not available on client."); };
export const deleteProductsByVendor = () => { throw new Error("Server-only: deleteProductsByVendor is not available on client."); };
export const deleteServicesByVendor = () => { throw new Error("Server-only: deleteServicesByVendor is not available on client."); };
export const deleteOrdersByVendor = () => { throw new Error("Server-only: deleteOrdersByVendor is not available on client."); };
export const deleteBookingsByVendor = () => { throw new Error("Server-only: deleteBookingsByVendor is not available on client."); };
export const deleteUserCartItemsByVendor = () => { throw new Error("Server-only: deleteUserCartItemsByVendor is not available on client."); };
export const deleteConversationsByVendor = () => { throw new Error("Server-only: deleteConversationsByVendor is not available on client."); };
export const deleteUser = () => { throw new Error("Server-only: deleteUser is not available on client."); };
export const deleteSessions = () => { throw new Error("Server-only: deleteSessions is not available on client."); };