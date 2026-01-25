import React from "react";
import { useNotification } from "@/contexts/NotificationContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

export default function OrderDetailsSlider({ open, onOpenChange, order, onStatusUpdated }: { open: boolean; onOpenChange: (v: boolean) => void; order: any; onStatusUpdated?: () => void }) {
  if (!order) return null;
  const { success, error: notifyError } = useNotification();
  // Prefer shippingInfo for customer details
  const shipping = order.shippingInfo || {};
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="h-full w-[92vw] sm:w-[420px] md:w-[520px] lg:w-[640px] bg-accent/10 backdrop-blur-md text-foreground rounded-l-2xl shadow-2xl p-0 border-l border-white/20 flex flex-col overflow-hidden"
      >
        <div className="flex-1 overflow-y-auto p-8">
          <SheetHeader>
            <SheetTitle className="text-2xl font-bold mb-2">Order Details</SheetTitle>
          </SheetHeader>
          <div className="space-y-6">
          <div>
            <div className="font-extrabold text-xl mb-1 text-accent">Order #{(order.orderId || order.id || "").toString().substring(0, 8).toUpperCase()}</div>
            <div className="text-sm text-muted-foreground mb-2">Placed on {order.createdAt ? (typeof order.createdAt === 'string' ? new Date(order.createdAt).toLocaleDateString() : order.createdAt?.toLocaleDateString?.()) : "Unknown date"}</div>
          </div>
          <div className="border-b border-white/10 pb-4 mb-4">
            <div className="font-semibold text-lg mb-2 text-accent">Customer Info</div>
            <div className="mb-1"><span className="font-medium">Name:</span> {`${shipping.firstName || ""} ${shipping.lastName || ""}`.trim() || order.customerName || "N/A"}</div>
            <div className="mb-1"><span className="font-medium">Email:</span> {shipping.email || order.customerEmail || "N/A"}</div>
            <div className="mb-1"><span className="font-medium">Phone:</span> {shipping.phone || order.customerPhone || "N/A"}</div>
            <div className="mb-1"><span className="font-medium">Address:</span> {shipping.address || "N/A"}</div>
          </div>
          <div className="border-b border-white/10 pb-4 mb-4">
            <div className="font-semibold text-lg mb-2 text-accent">Order Items</div>
            {order.products?.length > 0 ? order.products.map((prod, idx) => (
              <div key={idx} className="flex items-center gap-4 mb-3 bg-white/5 backdrop-blur-sm rounded-lg p-2">
                {prod.image && (
                  <img src={prod.image} alt={prod.title || "Product"} className="w-14 h-14 object-cover rounded shadow" />
                )}
                <div className="flex-1">
                  <div className="font-semibold">{prod.title || prod.productId}</div>
                  <div className="text-sm text-muted-foreground">Qty: {prod.quantity} × ₦{prod.price}</div>
                </div>
              </div>
            )) : <div className="text-muted-foreground">No items found.</div>}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="font-semibold text-lg">Total:</span>
            <span className="text-2xl font-extrabold text-accent">₦{order.totalAmount?.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Badge variant={order.status === "delivered" ? "default" : order.status === "shipped" ? "secondary" : order.status === "cancelled" ? "destructive" : "outline"} className="px-4 py-2 text-base font-semibold">
              {order.status}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-muted-foreground">
            {order.confirmedAt && <div><span className="font-semibold">Confirmed:</span> {new Date(order.confirmedAt).toLocaleString()}</div>}
            {order.shippedAt && <div><span className="font-semibold">Shipped:</span> {new Date(order.shippedAt).toLocaleString()}</div>}
            {order.outForDeliveryAt && <div><span className="font-semibold">Out for Delivery:</span> {new Date(order.outForDeliveryAt).toLocaleString()}</div>}
            {order.deliveredAt && <div><span className="font-semibold">Delivered:</span> {new Date(order.deliveredAt).toLocaleString()}</div>}
            {order.cancelledAt && <div><span className="font-semibold">Cancelled:</span> {new Date(order.cancelledAt).toLocaleString()}</div>}
          </div>
          {/* Vendor Actions */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              className="px-3 py-2 rounded-md bg-accent text-white text-sm font-semibold hover:bg-accent/90 disabled:opacity-50"
              disabled={order.status === 'confirmed' || order.status === 'processing' || order.status === 'shipped' || order.status === 'shipped_interstate' || order.status === 'out_for_delivery' || order.status === 'delivered'}
              onClick={async () => {
                try {
                  const res = await fetch('/api/vendor/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: order.orderId || order.id, status: 'confirmed', vendorId: order.vendor?.vendorId || order.storeId }) })
                  const json = await res.json();
                  if (res.ok && json.success) { success('Order confirmed'); onStatusUpdated?.(); onOpenChange(false); } else { notifyError(json.error || 'Failed to confirm order'); }
                } catch (e: any) { notifyError(e?.message || 'Failed to confirm order'); }
              }}
            >
              Confirm Order
            </button>
            <button
              className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
              disabled={order.status === 'shipped' || order.status === 'shipped_interstate' || order.status === 'out_for_delivery' || order.status === 'delivered'}
              onClick={async () => {
                try {
                  const res = await fetch('/api/vendor/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: order.orderId || order.id, status: 'shipped', vendorId: order.vendor?.vendorId || order.storeId }) })
                  const json = await res.json();
                  if (res.ok && json.success) { success('Marked as shipped'); onStatusUpdated?.(); onOpenChange(false); } else { notifyError(json.error || 'Failed to mark shipped'); }
                } catch (e: any) { notifyError(e?.message || 'Failed to mark shipped'); }
              }}
            >
              Mark Shipped
            </button>
            <button
              className="px-3 py-2 rounded-md bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-50"
              disabled={order.status === 'shipped' || order.status === 'shipped_interstate' || order.status === 'out_for_delivery' || order.status === 'delivered'}
              onClick={async () => {
                try {
                  const res = await fetch('/api/vendor/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: order.orderId || order.id, status: 'shipped_interstate', vendorId: order.vendor?.vendorId || order.storeId }) })
                  const json = await res.json();
                  if (res.ok && json.success) { success('Marked as shipped (interstate)'); onStatusUpdated?.(); onOpenChange(false); } else { notifyError(json.error || 'Failed to mark shipped (interstate)'); }
                } catch (e: any) { notifyError(e?.message || 'Failed to mark shipped (interstate)'); }
              }}
            >
              Shipped (Interstate)
            </button>
            <button
              className="px-3 py-2 rounded-md bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-50"
              disabled={order.status === 'out_for_delivery' || order.status === 'delivered'}
              onClick={async () => {
                try {
                  const res = await fetch('/api/vendor/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: order.orderId || order.id, status: 'out_for_delivery', vendorId: order.vendor?.vendorId || order.storeId }) })
                  const json = await res.json();
                  if (res.ok && json.success) { success('Out for delivery'); onStatusUpdated?.(); onOpenChange(false); } else { notifyError(json.error || 'Failed to mark out for delivery'); }
                } catch (e: any) { notifyError(e?.message || 'Failed to mark out for delivery'); }
              }}
            >
              Out for Delivery
            </button>
            <button
              className="px-3 py-2 rounded-md bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
              disabled={order.status === 'delivered'}
              onClick={async () => {
                try {
                  const res = await fetch('/api/vendor/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: order.orderId || order.id, status: 'delivered', vendorId: order.vendor?.vendorId || order.storeId }) })
                  const json = await res.json();
                  if (res.ok && json.success) { success('Marked delivered'); onStatusUpdated?.(); onOpenChange(false); } else { notifyError(json.error || 'Failed to mark delivered'); }
                } catch (e: any) { notifyError(e?.message || 'Failed to mark delivered'); }
              }}
            >
              Mark Delivered
            </button>
            <button
              className="px-3 py-2 rounded-md bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
              onClick={async () => {
                try {
                  const res = await fetch('/api/vendor/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: order.orderId || order.id, status: 'cancelled', vendorId: order.vendor?.vendorId || order.storeId }) })
                  const json = await res.json();
                  if (res.ok && json.success) { success('Order cancelled'); onStatusUpdated?.(); onOpenChange(false); } else { notifyError(json.error || 'Failed to cancel order'); }
                } catch (e: any) { notifyError(e?.message || 'Failed to cancel order'); }
              }}
            >
              Cancel Order
            </button>
          </div>
        </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
