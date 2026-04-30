import React, { useEffect, useState } from "react";
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

  // Countdown timer for escrow auto-release
  const [escrowCountdown, setEscrowCountdown] = useState<string>("");
  useEffect(() => {
    if (String(order.paymentStatus || '').toLowerCase() !== 'escrow' || !order.escrowReleaseAt) {
      setEscrowCountdown("");
      return;
    }
    const updateCountdown = () => {
      const now = Date.now();
      const releaseAt = new Date(order.escrowReleaseAt).getTime();
      const diff = releaseAt - now;
      if (diff <= 0) {
        setEscrowCountdown("Releasing soon");
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      let str = "";
      if (days > 0) str += `${days}d `;
      if (hours > 0 || days > 0) str += `${hours}h `;
      if (minutes > 0 || hours > 0 || days > 0) str += `${minutes}m `;
      str += `${seconds}s`;
      setEscrowCountdown(str.trim());
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [order.paymentStatus, order.escrowReleaseAt]);

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
          {/* Vertical timeline for all statuses and countdowns */}
          <div className="mt-6 mb-4">
            {(() => {
              const steps = [
                { label: 'ORDER PLACED', badge: 'ORDER PLACED', key: 'createdAt', desc: '' },
                { label: 'PENDING PAYMENT', badge: 'PENDING PAYMENT', key: 'pendingPaymentAt', desc: 'Awaiting payment confirmation.' },
                { label: 'CONFIRMED', badge: 'CONFIRMED', key: 'confirmedAt', desc: 'Order confirmed by vendor.' },
                { label: 'PROCESSING', badge: 'PROCESSING', key: 'processingAt', desc: 'Order is being processed.' },
                { label: 'SHIPPED', badge: 'SHIPPED', key: 'shippedAt', desc: '' },
                { label: 'SHIPPED (INTERSTATE)', badge: 'SHIPPED INTERSTATE', key: 'shippedInterstateAt', desc: '' },
                { label: 'OUT FOR DELIVERY', badge: 'OUT FOR DELIVERY', key: 'outForDeliveryAt', desc: '' },
                { label: 'DELIVERED', badge: 'DELIVERED', key: 'deliveredAt', desc: '' },
                { label: 'RECEIVED', badge: 'RECEIVED', key: 'receivedAt', desc: '' },
                { label: 'CANCELLED', badge: 'CANCELLED', key: 'cancelledAt', desc: 'Order was cancelled.' },
              ];
              const statusOrder = [
                'pending', 'pending_payment', 'confirmed', 'processing', 'shipped', 'shipped_interstate', 'out_for_delivery', 'delivered', 'received', 'cancelled'
              ];
              const currentIdx = statusOrder.indexOf(order.status);

              // Escrow/auto-cancel countdown logic
              let countdown = '';
              if (['pending', 'pending_payment'].includes(order.status) && order.autoCancelAt) {
                const diff = new Date(order.autoCancelAt).getTime() - Date.now();
                if (diff > 0) {
                  const hours = Math.floor(diff / (1000 * 60 * 60));
                  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                  countdown = `Auto-cancels in ${hours}h ${minutes}m`;
                } else {
                  countdown = 'Cancelling soon';
                }
              } else if (String(order.paymentStatus || '').toLowerCase() === 'escrow' && order.escrowReleaseAt) {
                const diff = new Date(order.escrowReleaseAt).getTime() - Date.now();
                if (diff > 0) {
                  const hours = Math.floor(diff / (1000 * 60 * 60));
                  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                  countdown = `Escrow auto-release in ${hours}h ${minutes}m`;
                } else {
                  countdown = 'Releasing soon';
                }
              }

              return steps.map((step, sidx) => {
                const date = order[step.key] || (step.key === 'createdAt' ? order.createdAt : undefined);
                const isActive = currentIdx >= sidx && order.status !== 'cancelled';
                const isCurrent = currentIdx === sidx;
                return (
                  <div key={step.label} className="mb-6 last:mb-0 flex items-start relative z-10">
                    <div className="relative flex flex-col items-center mr-4" style={{ minWidth: 20 }}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center border-2 z-10 text-xs font-bold ${isActive ? 'bg-accent text-white border-accent shadow' : 'bg-white text-accent border-accent/40'} ${isCurrent ? 'ring-2 ring-accent/40' : ''}`}>{isActive ? <>&#10003;</> : ''}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide mb-1 ${isActive ? 'bg-accent/90 text-white' : 'bg-muted text-muted-foreground border border-muted-foreground/20'}`}>{step.badge}</span>
                      <div className="text-xs text-muted-foreground">{date ? (typeof date === 'string' ? new Date(date).toLocaleDateString() : date?.toLocaleDateString?.()) : ''}</div>
                      {step.desc && <div className="text-xs text-muted-foreground max-w-xs">{step.desc}</div>}
                      {isCurrent && countdown && <div className="text-xs text-amber-700 font-semibold mt-1">{countdown}</div>}
                      {step.label === 'DELIVERED' && order.deliveredAt && (
                        <div className="text-xs text-accent mt-1">Delivered on {typeof order.deliveredAt === 'string' ? new Date(order.deliveredAt).toLocaleDateString() : order.deliveredAt?.toLocaleDateString?.()}</div>
                      )}
                      {step.label === 'RECEIVED' && (order as any).receivedAt && (
                        <div className="text-xs text-green-600 mt-1">Received on {typeof (order as any).receivedAt === 'string' ? new Date((order as any).receivedAt).toLocaleDateString() : (order as any).receivedAt?.toLocaleDateString?.()}</div>
                      )}
                      {step.label === 'CANCELLED' && order.cancelledAt && (
                        <div className="text-xs text-destructive mt-1">Cancelled on {typeof order.cancelledAt === 'string' ? new Date(order.cancelledAt).toLocaleDateString() : order.cancelledAt?.toLocaleDateString?.()}</div>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
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
