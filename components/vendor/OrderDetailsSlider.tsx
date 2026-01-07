import React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

export default function OrderDetailsSlider({ open, onOpenChange, order }) {
  if (!order) return null;
  // Prefer shippingInfo for customer details
  const shipping = order.shippingInfo || {};
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-lg w-full bg-white rounded-l-2xl shadow-2xl p-8 border-l border-accent">
        <SheetHeader>
          <SheetTitle className="text-2xl font-bold mb-2">Order Details</SheetTitle>
        </SheetHeader>
        <div className="space-y-6">
          <div>
            <div className="font-extrabold text-xl mb-1 text-accent">Order #{(order.orderId || order.id || "").toString().substring(0, 8).toUpperCase()}</div>
            <div className="text-sm text-muted-foreground mb-2">Placed on {order.createdAt ? (typeof order.createdAt === 'string' ? new Date(order.createdAt).toLocaleDateString() : order.createdAt?.toLocaleDateString?.()) : "Unknown date"}</div>
          </div>
          <div className="border-b pb-4 mb-4">
            <div className="font-semibold text-lg mb-2 text-accent">Customer Info</div>
            <div className="mb-1"><span className="font-medium">Name:</span> {`${shipping.firstName || ""} ${shipping.lastName || ""}`.trim() || order.customerName || "N/A"}</div>
            <div className="mb-1"><span className="font-medium">Email:</span> {shipping.email || order.customerEmail || "N/A"}</div>
            <div className="mb-1"><span className="font-medium">Phone:</span> {shipping.phone || order.customerPhone || "N/A"}</div>
            <div className="mb-1"><span className="font-medium">Address:</span> {shipping.address || "N/A"}</div>
          </div>
          <div className="border-b pb-4 mb-4">
            <div className="font-semibold text-lg mb-2 text-accent">Order Items</div>
            {order.products?.length > 0 ? order.products.map((prod, idx) => (
              <div key={idx} className="flex items-center gap-4 mb-3 bg-accent/5 rounded-lg p-2">
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
        </div>
        <SheetClose className="mt-8 w-full py-3 rounded-lg bg-accent text-white font-bold text-lg shadow hover:bg-accent/90 transition">Close</SheetClose>
      </SheetContent>
    </Sheet>
  );
}
