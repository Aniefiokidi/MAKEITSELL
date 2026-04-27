"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Package,
  ShoppingCart,
  AlertTriangle,
  TrendingUp,
  Banknote,
  Wrench,
  Calendar,
  Clock,
  Star,
  Plus,
  CreditCard
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { getSessionToken } from "@/lib/auth-client"
import Link from "next/link"
import VendorLayout from "@/components/vendor/VendorLayout"
import { VendorWalletModal } from "@/components/vendor/VendorWalletModal"


export default function VendorDashboardPage() {
  const { user, userProfile, loading } = useAuth();
  const [dashboard, setDashboard] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);
  // Popup for new vendors
  const [showSetupPopup, setShowSetupPopup] = useState(false);
  const [storeData, setStoreData] = useState<any>(null);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [activeTab, setActiveTab] = useState<"goods" | "services">("goods");
  const [setupPopupType, setSetupPopupType] = useState<"missing-store-image" | null>(null);

  const getSetupPopupSnoozeKey = (vendorId: string) => `mis:vendor:setup-popup:snooze:${vendorId}`;

  const getTodayStamp = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const dismissSetupPopupForToday = () => {
    if (!user?.uid || typeof window === "undefined") {
      setShowSetupPopup(false);
      return;
    }

    try {
      localStorage.setItem(getSetupPopupSnoozeKey(user.uid), getTodayStamp());
    } catch {
      // Ignore storage failures and still hide the popup for this session.
    }

    setShowSetupPopup(false);
  };

  const hasMeaningfulImage = (value: unknown) => {
    if (typeof value !== "string") return false;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    if (normalized === "/placeholder.svg") return false;
    if (/placeholder|default|no[-_ ]?image/.test(normalized)) return false;
    return true;
  };

  const hasStoreCardImage = (store: any) => {
    const candidates: string[] = [
      store?.storeImage,
      store?.logoImage,
      store?.logo,
      store?.profileImage,
      store?.bannerImage,
      store?.storeBanner,
      ...(Array.isArray(store?.bannerImages) ? store.bannerImages : []),
      ...(Array.isArray(store?.productImages) ? store.productImages : []),
    ].filter((item): item is string => typeof item === "string");

    return candidates.some((candidate) => hasMeaningfulImage(candidate));
  };

  useEffect(() => {
    // Prompt goods vendors who haven't set up logo/store-card images yet.
    const loadSetupStatus = async () => {
      if (!user?.uid) return;
      
      try {
        const [storesRes, servicesRes] = await Promise.all([
          fetch(`/api/database/stores?vendorId=${encodeURIComponent(user.uid)}`),
          fetch(`/api/database/services?providerId=${encodeURIComponent(user.uid)}&limit=1`),
        ]);

        const [storesData, servicesData] = await Promise.all([
          storesRes.json(),
          servicesRes.json(),
        ]);

        const stores = Array.isArray(storesData?.data) ? storesData.data : [];
        const services = Array.isArray(servicesData?.data) ? servicesData.data : [];

        if (stores.length > 0) {
          setStoreData(stores[0]);
        }

        const vendorType = userProfile?.vendorType || "both";

        if (userProfile?.role !== "vendor" || vendorType === "services") {
          setShowSetupPopup(false);
          setSetupPopupType(null);
          return;
        }

        const hasAtLeastOneStoreCardImage = stores.some((store: any) => hasStoreCardImage(store));
        const shouldShowMissingImagePopup = !hasAtLeastOneStoreCardImage;

        let snoozedToday = false;
        if (typeof window !== "undefined") {
          try {
            const snoozeValue = localStorage.getItem(getSetupPopupSnoozeKey(user.uid));
            snoozedToday = snoozeValue === getTodayStamp();
          } catch {
            snoozedToday = false;
          }
        }

        const shouldShow = shouldShowMissingImagePopup && !snoozedToday;
        setShowSetupPopup(shouldShow);
        setSetupPopupType(shouldShow ? "missing-store-image" : null);
      } catch (error) {
        console.error("Error loading setup status:", error);
        // Avoid false-positive popup on transient network/API errors.
        setShowSetupPopup(false);
        setSetupPopupType(null);
      }
    };

    loadSetupStatus();
  }, [user, userProfile]);

  // Format currency with commas
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-NG')
  }

  const refreshCombinedWalletBalance = async () => {
    try {
      const response = await fetch('/api/vendor/wallet/transactions', {
        method: 'GET',
        credentials: 'include',
      })
      const result = await response.json()
      if (response.ok && result?.success && typeof result.walletBalance === 'number') {
        setWalletBalance(result.walletBalance)
      }
    } catch {
      // keep last known wallet balance
    }
  }

  const loadDashboard = async () => {
    if (!user) return;
    setDataLoading(true);
    try {
      const res = await fetch(`/api/vendor/dashboard?vendorId=${encodeURIComponent(user.uid)}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setDashboard(data.data);
        setWalletBalance(data.data?.vendorWalletBalance || 0);
        await refreshCombinedWalletBalance();
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [user]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadDashboard();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user]);

  useEffect(() => {
    if (walletModalOpen) {
      refreshCombinedWalletBalance()
    }
  }, [walletModalOpen])

  // Show loading while authentication is being checked or userProfile is loading
  if (loading || (user && !userProfile)) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {loading ? "Checking authentication..." : "Loading profile..."}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Check if user is a vendor - redirect if not
  if (!user || userProfile?.role !== "vendor") {
    if (typeof window !== 'undefined') {
      window.location.href = '/unauthorized'
    }
    return null
  }

  const totalRevenue = dashboard?.totalRevenue || 0;
  const totalOrders = dashboard?.totalOrders || 0;
  const totalProducts = dashboard?.totalProducts || 0;
  const revenueChange = dashboard?.revenueChange;
  const ordersChange = dashboard?.ordersChange;
  const productsChange = dashboard?.productsChange;
  const newProductsThisWeek = dashboard?.newProductsThisWeek;
  const conversionRate = dashboard?.conversionRate?.toFixed(1) || "0.0";
  const conversionRateChange = dashboard?.conversionRateChange;
  const lowStockProducts = dashboard?.lowStockProducts || [];
  const recentOrders = dashboard?.recentOrders || [];
  const serviceRevenue = dashboard?.serviceRevenue || 0;
  const totalServices = dashboard?.totalServices || 0;
  const totalBookings = dashboard?.totalBookings || 0;
  const pendingBookings = dashboard?.pendingBookings || 0;
  const activeServices = dashboard?.activeServices || 0;
  const recentBookings = dashboard?.recentBookings || [];
  const customerSegmentation = dashboard?.customerSegmentation || { new: 0, repeat: 0, dormant: 0, highValue: 0, autoPromosTriggeredToday: 0 };
  const conversionFunnel = dashboard?.conversionFunnel || { stages: [], hints: [] };
  const smartCollections = dashboard?.smartCollections || { bestSellers: [], newArrivals: [], under5000: [] };

  const vendorType = userProfile?.vendorType || "both"

  return (
    <VendorLayout>
      {/* Setup popup for vendors missing store-card image/logo */}
      {showSetupPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white/80 dark:bg-gray-900/80 rounded-xl shadow-2xl p-8 max-w-sm mx-auto flex flex-col items-center justify-center border border-accent" style={{backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)'}}>
            <h2 className="text-xl font-bold mb-2 text-center">Quick Store Setup Needed</h2>
            <p className="mb-4 text-center text-muted-foreground">
              Your store card is missing logo/image setup. Complete a quick setup so your store ranks better in For You.
            </p>

            {setupPopupType === "missing-store-image" ? (
              <>
                <Button asChild className="w-full mb-2 font-semibold text-base shadow-lg border border-accent outline-accent outline-2 outline" variant="default" onClick={() => setShowSetupPopup(false)}>
                  <Link href="/vendor/setup-wizard">
                    Quick Store Setup
                  </Link>
                </Button>
                <Button asChild className="w-full mb-2 font-semibold text-base shadow-lg border-accent outline-accent outline-2 outline text-accent hover:bg-accent hover:text-white" variant="outline" onClick={() => setShowSetupPopup(false)}>
                  <Link href="/vendor/products/new">
                    Add First Product
                  </Link>
                </Button>
              </>
            ) : null}

            <Button variant="ghost" className="w-full mt-1 text-xs border border-accent/20 hover:bg-accent/10" onClick={dismissSetupPopupForToday}>
              Don't remind me today
            </Button>
          </div>
        </div>
      )}
      <div className="animate-fade-in">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-lg font-bold" style={{ textShadow: '1px 1px 0 hsl(var(--accent)), -1px -1px 0 hsl(var(--accent)), 1px -1px 0 hsl(var(--accent)), -1px 1px 0 hsl(var(--accent))' }}>Dashboard</h1>
            <p className="text-xs text-muted-foreground">Welcome back! Here's what's happening with your {vendorType === "services" ? "services" : "store"}.</p>
            <div className="mt-2">
              <Button asChild size="sm" variant="outline" className="border-accent outline-accent outline-2 outline text-accent hover:bg-accent hover:text-white">
                <Link href={(vendorType === "services" || (vendorType === "both" && activeTab === "services")) ? "/vendor/services/setup-wizard" : "/vendor/setup-wizard"}>{(vendorType === "services" || (vendorType === "both" && activeTab === "services")) ? "Open Service Setup Wizard" : "Open Setup Wizard"}</Link>
              </Button>
            </div>
          </div>
          <Button
            onClick={loadDashboard}
            disabled={dataLoading}
            variant="outline"
            size="sm"
            className="gap-2 border-accent outline-accent outline-2 outline text-accent hover:bg-accent hover:text-white"
          >
            {dataLoading ? (
              <>
                <span className="animate-spin">↻</span> Refreshing
              </>
            ) : (
              <>
                ↻ Refresh
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="mt-8">
        {vendorType === "both" ? (
          /* BOTH: Tabbed Dashboard */
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "goods" | "services")} className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="goods" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                My Goods
              </TabsTrigger>
              <TabsTrigger value="services" className="flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                My Services
              </TabsTrigger>
            </TabsList>

            {/* GOODS TAB */}
            <TabsContent value="goods" className="space-y-6">
              {renderGoodsDashboard(totalRevenue, totalProducts, totalOrders, conversionRate, lowStockProducts, recentOrders, customerSegmentation, conversionFunnel, smartCollections)}
            </TabsContent>

            {/* SERVICES TAB */}
            <TabsContent value="services" className="space-y-6">
              {renderServicesDashboard(serviceRevenue, totalServices, totalBookings, pendingBookings, activeServices, recentBookings)}
            </TabsContent>
          </Tabs>
        ) : vendorType === "goods" ? (
          /* GOODS ONLY: Direct Dashboard */
          renderGoodsDashboard(totalRevenue, totalProducts, totalOrders, conversionRate, lowStockProducts, recentOrders, customerSegmentation, conversionFunnel, smartCollections)
        ) : (
          /* SERVICES ONLY: Direct Dashboard */
          renderServicesDashboard(serviceRevenue, totalServices, totalBookings, pendingBookings, activeServices, recentBookings)
        )}
      </div>

      {/* Vendor Wallet Modal */}
      <VendorWalletModal
        open={walletModalOpen}
        onOpenChange={setWalletModalOpen}
        walletBalance={walletBalance}
        onBalanceUpdated={setWalletBalance}
      />
    </VendorLayout>
  )

  // Goods Dashboard Renderer
  function renderGoodsDashboard(
    revenue: number,
    productsCount: number,
    ordersCount: number,
    conversion: string | number,
    lowStock: any[],
    recent: any[],
    segmentation: any,
    funnel: any,
    collections: any
  ) {
    // Defensive fallback for undefined/null values
    const safeRevenueChange = typeof revenueChange === 'number' ? revenueChange : 0;
    const safeProductsChange = typeof productsChange === 'number' ? productsChange : 0;
    const safeOrdersChange = typeof ordersChange === 'number' ? ordersChange : 0;
    const safeConversionRateChange = typeof conversionRateChange === 'number' ? conversionRateChange : 0;
    const safeConversion = typeof conversion === 'string' ? conversion : (typeof conversion === 'number' ? conversion.toFixed(1) : '0.0');

    return (
      <>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <Card className="animate-scale-in hover-lift" style={{ animationDelay: '0.1s' }}>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-lg lg:text-xl font-bold truncate">₦{formatCurrency(revenue)}</p>
                  <p className="text-xs text-gray-600">Product Revenue</p>
                  <p className="text-xs text-green-600">
                    {`${safeRevenueChange >= 0 ? "+" : ""}${safeRevenueChange.toFixed(1)}% from last month`}
                  </p>
                </div>
                <Banknote className="h-7 w-7 lg:h-8 lg:w-8 text-accent animate-pulse-glow shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card className="animate-scale-in hover-lift" style={{ animationDelay: '0.2s' }}>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-lg lg:text-xl font-bold">{productsCount}</p>
                  <p className="text-xs text-gray-600">Products Listed</p>
                  <p className="text-xs text-green-600 truncate">
                    {typeof newProductsThisWeek === "number" ? `+${newProductsThisWeek} new this week` : ""}
                    {` (${safeProductsChange >= 0 ? "+" : ""}${safeProductsChange.toFixed(1)}% vs last week)`}
                  </p>
                </div>
                <Package className="h-7 w-7 lg:h-8 lg:w-8 text-accent animate-pulse-glow shrink-0" style={{ animationDelay: '0.2s' }} />
              </div>
            </CardContent>
          </Card>

          <Card className="animate-scale-in hover-lift" style={{ animationDelay: '0.3s' }}>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-lg lg:text-xl font-bold">{ordersCount}</p>
                  <p className="text-xs text-gray-600">Total Orders</p>
                  <p className="text-xs text-green-600">
                    {`${safeOrdersChange >= 0 ? "+" : ""}${safeOrdersChange.toFixed(1)}% from last month`}
                  </p>
                </div>
                <ShoppingCart className="h-7 w-7 lg:h-8 lg:w-8 text-accent animate-pulse-glow shrink-0" style={{ animationDelay: '0.4s' }} />
              </div>
            </CardContent>
          </Card>

          <Card className="animate-scale-in hover-lift" style={{ animationDelay: '0.4s' }}>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-lg lg:text-xl font-bold">{safeConversion}%</p>
                  <p className="text-xs text-gray-600">Conversion Rate</p>
                  <p className="text-xs text-green-600">
                    {`${safeConversionRateChange >= 0 ? "+" : ""}${safeConversionRateChange.toFixed(1)}% from last month`}
                  </p>
                </div>
                <TrendingUp className="h-7 w-7 lg:h-8 lg:w-8 text-accent animate-pulse-glow shrink-0" style={{ animationDelay: '0.6s' }} />
              </div>
            </CardContent>
          </Card>

          <Card className="animate-scale-in hover-lift cursor-pointer" style={{ animationDelay: '0.5s' }} onClick={() => setWalletModalOpen(true)}>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-lg lg:text-xl font-bold truncate">₦{formatCurrency(walletBalance)}</p>
                  <p className="text-xs text-gray-600">Wallet Balance</p>
                  <p className="text-xs text-blue-600">Click to manage</p>
                </div>
                <CreditCard className="h-7 w-7 lg:h-8 lg:w-8 text-accent animate-pulse-glow shrink-0" style={{ animationDelay: '0.5s' }} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders and Low Stock */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
              <CardDescription>Latest product orders from customers</CardDescription>
            </CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-gray-600 mb-4">No orders yet</p>
                   <Button asChild variant="outline" className="border-accent/40 text-accent hover:bg-accent hover:text-white hover:scale-105 transition-all hover:shadow-lg">
                                <Link href="/vendor/products/new">
                                  <Plus className="mr-2 h-4 w-4" />
                                  Add Product
                                </Link>
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {recent.map((order, index) => (
                      <div key={order.id || order._id || index} className="p-3 rounded-lg hover:bg-accent/5 transition-colors border border-gray-100">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium">Order #{(order.id || order._id || "").toString().slice(-8).toUpperCase()}</p>
                            <p className="text-sm text-gray-600">
                              {order.createdAt ? (typeof order.createdAt === 'string' ? new Date(order.createdAt).toLocaleDateString() : order.createdAt?.toLocaleDateString?.() || 'Unknown date') : 'Unknown date'}
                            </p>
                          </div>
                          <Badge variant="outline">{order.status}</Badge>
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <p className="text-sm font-medium text-gray-700 mb-1">
                            👤 {order.customerName || "Unknown Customer"}
                          </p>
                          {order.vendorItems && order.vendorItems.length > 0 ? (
                            <div className="space-y-2">
                              {order.vendorItems.slice(0, 2).map((item: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <img 
                                    src={item.image || item.images?.[0] || "/placeholder.png"} 
                                    alt={item.title || item.name || "Product"}
                                    className="w-10 h-10 rounded object-cover border border-gray-200"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-gray-600 truncate">
                                      {item.title || item.name || "Product"}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      Qty: {item.quantity || 1}
                                    </p>
                                  </div>
                                </div>
                              ))}
                              {order.vendorItems.length > 2 && (
                                <p className="text-xs text-gray-500 italic pl-12">
                                  +{order.vendorItems.length - 2} more item{order.vendorItems.length - 2 > 1 ? 's' : ''}
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500">No items</p>
                          )}
                          <p className="text-xs font-semibold text-gray-700 mt-2">
                            Total Qty: {order.totalQuantity || 0}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" className="mt-4 w-full border-accent/40 text-accent hover:bg-accent hover:text-white" asChild>
                    <Link href="/vendor/orders">View All Orders</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="mr-2 h-5 w-5 text-orange-500" />
                Low Stock Alert
              </CardTitle>
              <CardDescription>Products running low on inventory</CardDescription>
            </CardHeader>
            <CardContent>
              {lowStock.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <p className="text-gray-600">All products well stocked!</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {lowStock.map((product, index) => (
                      <div key={product.id || product._id || index} className="flex justify-between items-center p-2 rounded hover:bg-accent/5">
                        <span className="text-sm">{product.title}</span>
                        <Badge variant="destructive">{product.stock} left</Badge>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" className="mt-4 w-full border-accent/40 text-accent hover:bg-accent hover:text-white" asChild>
                    <Link href="/vendor/products">Manage Inventory</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Segmentation</CardTitle>
              <CardDescription>Behavior groups with automatic promo triggers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span>New</span><Badge variant="outline">{segmentation.new}</Badge></div>
              <div className="flex justify-between"><span>Repeat</span><Badge variant="outline">{segmentation.repeat}</Badge></div>
              <div className="flex justify-between"><span>Dormant</span><Badge variant="outline">{segmentation.dormant}</Badge></div>
              <div className="flex justify-between"><span>High-Value</span><Badge variant="outline">{segmentation.highValue}</Badge></div>
              <div className="pt-2 border-t flex justify-between"><span>Auto Promos Today</span><Badge>{segmentation.autoPromosTriggeredToday}</Badge></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Conversion Funnel</CardTitle>
              <CardDescription>Visits to checkout performance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(funnel?.stages || []).map((stage: any) => (
                <div key={stage.key} className="flex justify-between">
                  <span>{stage.label}</span>
                  <Badge variant="outline">{stage.value}</Badge>
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-1">
                Tracked events ({Number(funnel?.lookbackDays || 30)}d): {Number(funnel?.trackedEventsInRange || 0).toLocaleString()}
              </p>
              {(funnel?.hints || []).slice(0, 2).map((hint: string, idx: number) => (
                <p key={idx} className="text-xs text-muted-foreground">• {hint}</p>
              ))}
              <Button asChild size="sm" variant="outline" className="w-full mt-2 border-accent/40 text-accent hover:bg-accent hover:text-white">
                <Link href="/vendor/conversion-funnel">Open Full Funnel</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Smart Collections</CardTitle>
              <CardDescription>Auto-curated product groups.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-medium">Best Sellers</p>
                <p className="text-xs text-muted-foreground">{(collections?.bestSellers || []).length} products</p>
              </div>
              <div>
                <p className="font-medium">New Arrivals</p>
                <p className="text-xs text-muted-foreground">{(collections?.newArrivals || []).length} products</p>
              </div>
              <div>
                <p className="font-medium">Under N5,000</p>
                <p className="text-xs text-muted-foreground">{(collections?.under5000 || []).length} products</p>
              </div>
              <Button asChild size="sm" variant="outline" className="w-full border-accent/40 text-accent hover:bg-accent hover:text-white">
                <Link href="/vendor/products">View Products</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  // Services Dashboard Renderer
  function renderServicesDashboard(
    revenue: number,
    servicesCount: number,
    bookingsCount: number,
    pending: number,
    active: number,
    recent: any[]
  ) {
    return (
      <>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <Card className="animate-scale-in hover-lift" style={{ animationDelay: '0.1s' }}>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-lg lg:text-xl font-bold truncate">₦{formatCurrency(revenue)}</p>
                  <p className="text-xs text-gray-600">Service Revenue</p>
                  <p className="text-xs text-green-600">Completed bookings</p>
                </div>
                <Banknote className="h-7 w-7 lg:h-8 lg:w-8 text-accent animate-pulse-glow shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card className="animate-scale-in hover-lift" style={{ animationDelay: '0.2s' }}>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-lg lg:text-xl font-bold">{servicesCount}</p>
                  <p className="text-xs text-gray-600">Services Offered</p>
                  <p className="text-xs text-blue-600">{active} active</p>
                </div>
                <Wrench className="h-7 w-7 lg:h-8 lg:w-8 text-accent animate-pulse-glow shrink-0" style={{ animationDelay: '0.2s' }} />
              </div>
            </CardContent>
          </Card>

          <Card className="animate-scale-in hover-lift" style={{ animationDelay: '0.3s' }}>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-lg lg:text-xl font-bold">{bookingsCount}</p>
                  <p className="text-xs text-gray-600">Total Bookings</p>
                  <p className="text-xs text-amber-600">{pending} pending</p>
                </div>
                <Calendar className="h-7 w-7 lg:h-8 lg:w-8 text-accent animate-pulse-glow shrink-0" style={{ animationDelay: '0.4s' }} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Bookings and Service Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base lg:text-lg">Recent Bookings</CardTitle>
              <CardDescription className="text-xs lg:text-sm">Latest service appointments</CardDescription>
            </CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-10 w-10 lg:h-12 lg:w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm lg:text-base text-gray-600 mb-4">No bookings yet</p>
                  <Button asChild variant="outline" size="sm" className="text-xs lg:text-sm border-accent/40 text-accent hover:bg-accent hover:text-white">
                    <Link href="/vendor/services/setup-wizard">
                      <Plus className="mr-2 h-3 w-3 lg:h-4 lg:w-4" />
                      Add Your First Service
                    </Link>
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {recent.map((booking, index) => (
                      <div key={booking.id || booking._id || index} className="flex justify-between items-center p-3 rounded-lg hover:bg-accent/5 transition-colors">
                        <div className="flex items-start gap-3">
                          <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="font-medium">{booking.customerName}</p>
                            <p className="text-sm text-gray-600">
                              {new Date(booking.bookingDate).toLocaleDateString()} at {booking.startTime}
                            </p>
                          </div>
                        </div>
                        <Badge 
                          variant={
                            booking.status === "confirmed" ? "default" : 
                            booking.status === "pending" ? "secondary" : 
                            booking.status === "completed" ? "outline" : 
                            "destructive"
                          }
                        >
                          {booking.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" className="mt-4 w-full border-accent/40 text-accent hover:bg-accent hover:text-white" asChild>
                    <Link href="/vendor/bookings">View All Bookings</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Service Performance</CardTitle>
              <CardDescription>Your service metrics overview</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 rounded-lg bg-green-50">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center">
                      <Wrench className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium">Active Services</p>
                      <p className="text-sm text-gray-600">Currently available</p>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-green-600">{active}</p>
                </div>

                <div className="flex justify-between items-center p-3 rounded-lg bg-amber-50">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-amber-500 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium">Pending Approvals</p>
                      <p className="text-sm text-gray-600">Awaiting confirmation</p>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-amber-600">{pending}</p>
                </div>

                <Button variant="outline" className="w-full border-accent/40 text-accent hover:bg-accent hover:text-white" asChild>
                  <Link href="/vendor/services">Manage Services</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }
}
