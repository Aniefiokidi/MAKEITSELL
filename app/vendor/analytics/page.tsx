"use client"

import { useState, useEffect } from "react"
import VendorLayout from "@/components/vendor/VendorLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/AuthContext"
import { BarChart3, TrendingUp, Users, DollarSign, Package, ShoppingCart } from "lucide-react"


export default function VendorAnalyticsPage() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadAnalytics = async () => {
      if (!user) return;
      setLoading(true);
      setError("");
      try {
        if (!user?.uid) throw new Error("No vendor ID");
        const res = await fetch(`/api/vendor/analytics?vendorId=${encodeURIComponent(user.uid)}`);
        const data = await res.json();
        if (data.success) {
          setAnalytics(data.data);
        } else {
          setError(data.error || "Failed to load analytics");
        }
      } catch (err) {
        setError("Failed to load analytics");
      } finally {
        setLoading(false);
      }
    };
    loadAnalytics();
  }, [user]);

  if (loading) {
    return (
      <VendorLayout>
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </VendorLayout>
    );
  }

  if (error) {
    return (
      <VendorLayout>
        <div className="flex items-center justify-center py-16 text-red-600">{error}</div>
      </VendorLayout>
    );
  }

  const totalRevenue = analytics?.totalRevenue || 0;
  const totalOrders = analytics?.totalOrders || 0;
  const totalProducts = analytics?.totalProducts || 0;
  const averageOrderValue = analytics?.avgOrderValue || 0;
  // Format currency in Naira
  const formatNaira = (amount: number) => `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const revenueChange = analytics?.revenueChange;
  const ordersChange = analytics?.ordersChange;
  const productsChange = analytics?.productsChange;
  const avgOrderValueChange = analytics?.avgOrderValueChange;
  const newProductsThisWeek = analytics?.newProductsThisWeek;
  const recentOrders = analytics?.recentOrders || [];
  const topProducts = analytics?.topProducts || [];

  return (
    <VendorLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Track your store's performance and sales metrics</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{formatNaira(totalRevenue)}</p>
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-xs text-green-600">
                    {revenueChange === null ? "" : `${revenueChange >= 0 ? "+" : ""}${revenueChange.toFixed(1)}% from last month`}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{totalOrders}</p>
                  <p className="text-sm text-gray-600">Total Orders</p>
                  <p className="text-xs text-green-600">
                    {ordersChange === null ? "" : `${ordersChange >= 0 ? "+" : ""}${ordersChange.toFixed(1)}% from last month`}
                  </p>
                </div>
                <ShoppingCart className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{totalProducts}</p>
                  <p className="text-sm text-gray-600">Products Listed</p>
                  <p className="text-xs text-green-600">
                    {typeof newProductsThisWeek === "number" ? `+${newProductsThisWeek} new this week` : ""}
                    {productsChange !== null && ` (${productsChange >= 0 ? "+" : ""}${productsChange.toFixed(1)}% vs last week)`}
                  </p>
                </div>
                <Package className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{formatNaira(averageOrderValue)}</p>
                  <p className="text-sm text-gray-600">Avg Order Value</p>
                  <p className="text-xs text-green-600">
                    {avgOrderValueChange === null ? "" : `${avgOrderValueChange >= 0 ? "+" : ""}${avgOrderValueChange.toFixed(1)}% from last month`}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders and Top Products */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {recentOrders.length === 0 ? (
                <p className="text-gray-600">No orders yet.</p>
              ) : (
                <div className="space-y-4">
                  {recentOrders.map((order: any) => (
                    <div key={order._id || order.id} className="flex justify-between items-center border-b pb-2">
                      <div>
                        <p className="font-medium">Order #{(order._id || order.id || "").toString().slice(-8)}</p>
                        <p className="text-sm text-gray-600">
                          {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatNaira(order.total || order.totalAmount || 0)}</p>
                        <Badge variant="outline">{order.status || "N/A"}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Performing Products</CardTitle>
            </CardHeader>
            <CardContent>
              {topProducts.length === 0 ? (
                <p className="text-gray-600">No sales data yet.</p>
              ) : (
                <div className="space-y-4">
                  {topProducts.map((product: any) => (
                    <div key={product._id || product.id} className="flex justify-between items-center border-b pb-2">
                      <div>
                        <p className="font-medium">{product.title || product.name}</p>
                        <p className="text-sm text-gray-600">{product.sales || 0} sold</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">₦{product.price}</p>
                        <Badge variant="secondary">{product.category}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </VendorLayout>
  )
}