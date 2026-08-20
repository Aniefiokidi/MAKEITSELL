import { getAllOrders, getAllProducts } from './mongodb-operations';
import { isSettledVendorSale } from './analytics';

export type BestSellerWindow = '7d' | '30d' | '90d' | 'all';

export interface BestSellerProduct {
  productId: string;
  name: string;
  image: string | null;
  category: string | null;
  vendorId: string;
  vendorName: string | null;
  storeId: string | null;
  unitsSold: number;
  revenue: number;
  previousUnitsSold: number | null;
  changePercent: number | null;
  trend: 'up' | 'down' | 'flat' | 'new';
  projectedNextPeriodUnits: number | null;
}

export interface BestSellersResult {
  window: BestSellerWindow;
  periodStart: string | null;
  periodEnd: string;
  previousPeriodStart: string | null;
  previousPeriodEnd: string | null;
  dailyBreakdown: { date: string; unitsSold: number }[];
  products: BestSellerProduct[];
}

const WINDOW_DAYS: Record<Exclude<BestSellerWindow, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

interface ProductSnapshot {
  name: string;
  image: string | null;
  category: string | null;
  vendorId: string;
  vendorName: string | null;
  storeId: string | null;
}

function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Each order's real per-vendor legs, with the fallback to the legacy flat `items` shape
// for orders that predate the vendors[] split — same fallback lib/analytics.ts's
// getVendorOrderTotal uses.
function getOrderLegs(order: any): { items: any[]; status: string | undefined; storeId: string | null }[] {
  if (Array.isArray(order.vendors) && order.vendors.length > 0) {
    return order.vendors.map((v: any) => ({
      items: Array.isArray(v.items) ? v.items : [],
      status: v.status,
      storeId: v.storeId || null,
    }));
  }
  return [{ items: Array.isArray(order.items) ? order.items : [], status: order.status, storeId: null }];
}

export async function getBestSellers(window: BestSellerWindow): Promise<BestSellersResult> {
  const now = new Date();
  const currentEnd = now;
  let currentStart: Date | null = null;
  let previousStart: Date | null = null;
  let previousEnd: Date | null = null;

  if (window !== 'all') {
    const days = WINDOW_DAYS[window];
    currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    previousEnd = currentStart;
    previousStart = new Date(currentStart.getTime() - days * 24 * 60 * 60 * 1000);
  }

  const [orders, products] = await Promise.all([getAllOrders(), getAllProducts()]);
  const productById = new Map<string, any>();
  products.forEach((p: any) => productById.set(String(p.id || p._id || ''), p));

  const currentUnits = new Map<string, number>();
  const currentRevenue = new Map<string, number>();
  const previousUnits = new Map<string, number>();
  const dailyUnits = new Map<string, number>();
  const snapshots = new Map<string, ProductSnapshot>();

  for (const order of orders) {
    const createdAt = order.createdAt ? new Date(order.createdAt) : null;
    if (!createdAt || Number.isNaN(createdAt.getTime())) continue;

    const inCurrentWindow = currentStart ? createdAt >= currentStart && createdAt <= currentEnd : true;
    const inPreviousWindow =
      previousStart && previousEnd ? createdAt >= previousStart && createdAt < previousEnd : false;
    if (!inCurrentWindow && !inPreviousWindow) continue;

    const legs = getOrderLegs(order);
    for (const leg of legs) {
      if (!isSettledVendorSale(order, leg.status)) continue;

      for (const item of leg.items) {
        const productId = String(item?.productId || '');
        const quantity = Number(item?.quantity || 0);
        if (!productId || quantity <= 0) continue;

        if (!snapshots.has(productId)) {
          snapshots.set(productId, {
            name: item.title || item.name || 'Product',
            image: item.image || null,
            category: item.category || null,
            vendorId: item.vendorId || '',
            vendorName: item.vendorName || null,
            storeId: leg.storeId || item.storeId || null,
          });
        }

        if (inCurrentWindow) {
          currentUnits.set(productId, (currentUnits.get(productId) || 0) + quantity);
          currentRevenue.set(
            productId,
            (currentRevenue.get(productId) || 0) + Number(item?.price || 0) * quantity
          );
          const dayKey = toDayKey(createdAt);
          dailyUnits.set(dayKey, (dailyUnits.get(dayKey) || 0) + quantity);
        } else if (inPreviousWindow) {
          previousUnits.set(productId, (previousUnits.get(productId) || 0) + quantity);
        }
      }
    }
  }

  const productIds = new Set<string>([...currentUnits.keys(), ...previousUnits.keys()]);

  const ranked: BestSellerProduct[] = Array.from(productIds)
    .map((productId) => {
      const unitsSold = currentUnits.get(productId) || 0;
      const revenue = currentRevenue.get(productId) || 0;
      const previousUnitsSold = window === 'all' ? null : previousUnits.get(productId) || 0;

      let changePercent: number | null;
      let trend: BestSellerProduct['trend'];
      let projectedNextPeriodUnits: number | null;

      if (previousUnitsSold === null) {
        changePercent = null;
        trend = 'flat';
        projectedNextPeriodUnits = null;
      } else if (previousUnitsSold === 0) {
        if (unitsSold === 0) {
          changePercent = 0;
          trend = 'flat';
        } else {
          changePercent = null;
          trend = 'new';
        }
        projectedNextPeriodUnits = unitsSold;
      } else {
        changePercent = ((unitsSold - previousUnitsSold) / previousUnitsSold) * 100;
        trend = changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'flat';
        projectedNextPeriodUnits = Math.max(0, Math.round(2 * unitsSold - previousUnitsSold));
      }

      const product = productById.get(productId);
      const snapshot = snapshots.get(productId);

      return {
        productId,
        name: product?.name || snapshot?.name || 'Product',
        image: product?.images?.[0] || snapshot?.image || null,
        category: product?.category || snapshot?.category || null,
        vendorId: product?.vendorId || snapshot?.vendorId || '',
        vendorName: product?.vendorName || snapshot?.vendorName || null,
        storeId: product?.storeId || snapshot?.storeId || null,
        unitsSold,
        revenue,
        previousUnitsSold,
        changePercent,
        trend,
        projectedNextPeriodUnits,
      };
    })
    .filter((p) => p.unitsSold > 0)
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, 10);

  let dailyBreakdown: { date: string; unitsSold: number }[];
  if (currentStart) {
    dailyBreakdown = [];
    const cursor = new Date(toDayKey(currentStart) + 'T00:00:00.000Z');
    const endKey = toDayKey(currentEnd);
    while (toDayKey(cursor) <= endKey) {
      const key = toDayKey(cursor);
      dailyBreakdown.push({ date: key, unitsSold: dailyUnits.get(key) || 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  } else {
    dailyBreakdown = Array.from(dailyUnits.entries())
      .map(([date, unitsSold]) => ({ date, unitsSold }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  return {
    window,
    periodStart: currentStart ? currentStart.toISOString() : null,
    periodEnd: currentEnd.toISOString(),
    previousPeriodStart: previousStart ? previousStart.toISOString() : null,
    previousPeriodEnd: previousEnd ? previousEnd.toISOString() : null,
    dailyBreakdown,
    products: ranked,
  };
}
