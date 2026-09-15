import mongoose from 'mongoose';
import connectToDatabase from './mongodb';
import { Store } from './models/Store';

export async function resolveStoreScope(storeId: string, ownerId?: string) {
  await connectToDatabase();
  if (!mongoose.Types.ObjectId.isValid(storeId)) throw new Error('Invalid store');
  const store: any = await Store.findById(storeId).lean();
  if (!store || (ownerId && String(store.vendorId) !== ownerId)) throw new Error('Store does not belong to this account');
  const first: any = await Store.findOne({ vendorId: store.vendorId }).sort({ _id: 1 }).select('_id').lean();
  return { storeId: String(store._id), ownerId: String(store.vendorId), includeLegacy: String(first?._id) === String(store._id) };
}
export type StoreScope = Awaited<ReturnType<typeof resolveStoreScope>>;
export function belongsToStore(record: { storeId?: unknown }, scope: StoreScope) {
  return record.storeId ? String(record.storeId) === scope.storeId : scope.includeLegacy;
}
export function storeListingQuery(scope: StoreScope, ownerField: 'vendorId' | 'providerId') {
  return { [ownerField]: scope.ownerId, ...(scope.includeLegacy
    ? { $or: [{ storeId: scope.storeId }, { storeId: { $in: [null, ''] } }] }
    : { storeId: scope.storeId }) };
}
export async function resolveListingStore(ownerId: string, requested?: unknown): Promise<string | undefined> {
  if (requested) return (await resolveStoreScope(String(requested), ownerId)).storeId;
  await connectToDatabase();
  const original: any = await Store.findOne({ vendorId: ownerId }).sort({ _id: 1 }).select('_id').lean();
  return original ? String(original._id) : undefined;
}
