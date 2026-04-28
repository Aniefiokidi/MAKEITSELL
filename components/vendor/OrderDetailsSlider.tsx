import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export default function OrderDetailsSlider({ open, onOpenChange, order, onStatusUpdated }: { open: boolean; onOpenChange: (v: boolean) => void; order: any; onStatusUpdated?: () => void }) {
  if (!order) return null;
  // Prefer shippingInfo for customer details
  const shipping = order.shippingInfo || {};
  const productSubtotal = Number.isFinite(Number(order?.vendor?.total))
    ? Number(order.vendor.total)
    : (Array.isArray(order.products)
      ? order.products.reduce((sum: number, prod: any) => {
          const qty = Number(prod?.quantity || 0)
          const unitPrice = Number(prod?.price || 0)
          return sum + (Number.isFinite(qty) ? qty : 0) * (Number.isFinite(unitPrice) ? unitPrice : 0)
        }, 0)
      : 0)
  const grossTotal = Number.isFinite(Number(order?.totalAmount)) ? Number(order.totalAmount) : productSubtotal
  const deliveryFee = Number.isFinite(Number(order?.deliveryFee))
    ? Number(order.deliveryFee)
    : Math.max(0, grossTotal - productSubtotal)
  const total = productSubtotal + deliveryFee

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92vw] sm:max-w-[680px] bg-accent/10 backdrop-blur-md text-foreground rounded-2xl shadow-2xl p-0 border border-white/20 flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold mb-2">Order Details</DialogTitle>
          </DialogHeader>
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
            {order.products?.length > 0 ? order.products.map((prod: any, idx: number) => (
              <div key={idx} className="flex items-center gap-4 mb-3 bg-white/5 backdrop-blur-sm rounded-lg p-2">
                {prod.image && (
                  <img src={prod.image} alt={prod.title || "Product"} className="w-14 h-14 object-cover rounded shadow" />
                )}
                <div className="flex-1">
                  <div className="font-semibold">{prod.title || prod.productId}</div>
                  <div className="text-sm text-muted-foreground">Qty: {prod.quantity} × ₦{Number(prod.price || 0).toLocaleString()}</div>
                </div>
              </div>
            )) : <div className="text-muted-foreground">No items found.</div>}
          </div>
          <div className="rounded-lg border border-white/20 bg-white/5 p-3 mt-2 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Product Subtotal:</span>
              <span className="font-semibold">₦{productSubtotal.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Delivery Fee:</span>
              <span className="font-semibold">{deliveryFee > 0 ? `₦${deliveryFee.toLocaleString()}` : 'FREE'}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-white/20">
              <span className="font-semibold text-lg">Total:</span>
              <span className="text-2xl font-extrabold text-accent">₦{total.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Badge variant={order.status === "delivered" ? "default" : order.status === "shipped" ? "secondary" : order.status === "cancelled" ? "destructive" : "outline"} className="px-4 py-2 text-base font-semibold">
              {order.status}
            </Badge>
            <Badge variant={String(order.paymentStatus || '').toLowerCase() === 'released' ? 'secondary' : 'outline'} className="px-4 py-2 text-base font-semibold">
              payment: {order.paymentStatus || 'pending'}
            </Badge>
          </div>
          {String(order.paymentStatus || '').toLowerCase() === 'escrow' && (
            <div className="text-xs text-amber-700 mt-2">
              Buyer has paid. Funds are in escrow.
              {order.escrowReleaseAt ? ` Auto-release scheduled: ${new Date(order.escrowReleaseAt).toLocaleString()}` : ''}
            </div>
          )}
          {String(order.paymentStatus || '').toLowerCase() === 'released' && (
            <div className="text-xs text-green-700 mt-2">
              Escrow released to vendor wallet.
              {order.releasedAt ? ` Released at: ${new Date(order.releasedAt).toLocaleString()}` : ''}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-muted-foreground">
            {order.confirmedAt && <div><span className="font-semibold">Confirmed:</span> {new Date(order.confirmedAt).toLocaleString()}</div>}
            {order.shippedAt && <div><span className="font-semibold">Shipped:</span> {new Date(order.shippedAt).toLocaleString()}</div>}
            {order.outForDeliveryAt && <div><span className="font-semibold">Out for Delivery:</span> {new Date(order.outForDeliveryAt).toLocaleString()}</div>}
            {order.deliveredAt && <div><span className="font-semibold">Delivered:</span> {new Date(order.deliveredAt).toLocaleString()}</div>}
            {order.cancelledAt && <div><span className="font-semibold">Cancelled:</span> {new Date(order.cancelledAt).toLocaleString()}</div>}
          </div>
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Delivery status updates are restricted to logistics and admin accounts for escrow safety.
          </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
