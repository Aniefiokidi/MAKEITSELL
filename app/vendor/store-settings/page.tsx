"use client"

import { useState, useEffect, useRef } from "react"
// NotificationBox component
function NotificationBox({ message, show, onClose, type = "success" }: { message: string; show: boolean; onClose: () => void; type?: "success" | "error" }) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 transition-transform duration-300 ${show ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'} ${type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white px-6 py-4 rounded shadow-lg flex items-center`}
      style={{ minWidth: 250 }}
      role="alert"
    >
      <span className="flex-1">{message}</span>
      <button
        className="ml-4 text-white hover:text-gray-200 focus:outline-none"
        onClick={onClose}
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
}
import VendorLayout from "@/components/vendor/VendorLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/contexts/AuthContext"
import type { IStore as StoreType } from "@/lib/models"
import { uploadToCloudinary } from "@/lib/cloudinary"
import { updateUserProfile } from "@/lib/update-user-profile"
import { Save, Loader2 } from "lucide-react"
import LocationPicker from "@/components/LocationPicker"

export default function VendorStoreSettingsPage() {
  const { user, userProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [storeData, setStoreData] = useState<StoreType | null>(null)
  // Notification state
  const [notification, setNotification] = useState("");
  const [showNotification, setShowNotification] = useState(false);
  const [notificationType, setNotificationType] = useState<"success" | "error">("success");
  const notificationTimeout = useRef<NodeJS.Timeout | null>(null);

  function showNotificationBox(msg: string, type: "success" | "error" = "success") {
    setNotification(msg);
    setNotificationType(type);
    setShowNotification(true);
    if (notificationTimeout.current) clearTimeout(notificationTimeout.current);
    notificationTimeout.current = setTimeout(() => setShowNotification(false), 3500);
  }
  // No virtual store logic: always allow saving if a real store exists
  const isVirtualStore = false;
  const [settings, setSettings] = useState({
    fullName: userProfile?.displayName || "",
    email: userProfile?.email || "",
    storeName: "",
    storeDescription: "",
    contactEmail: "",
    contactPhone: "",
    businessAddress: "",
    storeCategory: "",
    deliveryTime: "",
    deliveryFee: 500,
    minimumOrder: 2000,
    returnPolicy: "",
    shippingPolicy: "",
    acceptReturns: true,
    acceptExchanges: true,
    autoFulfill: false,
    emailNotifications: true,
  })
  const [backgroundImage, setBackgroundImage] = useState<string>("")
  const [newBackgroundFile, setNewBackgroundFile] = useState<File | null>(null)
  const [backgroundPreview, setBackgroundPreview] = useState<string>("")
  const [bgUploading, setBgUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Profile Card Image (large background/profile photo)
  const [profileImage, setProfileImage] = useState<string>("");
  const [newProfileFile, setNewProfileFile] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string>("");
  const [profileUploading, setProfileUploading] = useState(false);
  const profileInputRef = useRef<HTMLInputElement>(null);

  const loadStoreData = async () => {
    if (user) {
      try {
        // Fetch the store for this vendor via API
        const res = await fetch(`/api/database/stores`);
        const data = await res.json();
        let userStore = null;
        if (data.success && Array.isArray(data.data)) {
          userStore = data.data.find((store: any) => store.vendorId === user.uid);
        }
        if (userStore) {
          setStoreData(userStore);
          setSettings(prev => ({
            ...prev,
            storeName: userStore.storeName || "",
            storeDescription: userStore.storeDescription || "",
            contactEmail: userStore.email || userProfile?.email || "",
            contactPhone: userStore.phone || "",
            businessAddress: userStore.address || "",
            storeCategory: userStore.category || "",
            deliveryTime: userStore.deliveryTime || "30-60 min",
            deliveryFee: userStore.deliveryFee || 500,
            minimumOrder: userStore.minimumOrder || 2000,
          }));
          setBackgroundImage(userStore.backgroundImage || userStore.storeImage || userStore.logoImage || "");
          setBackgroundPreview("");
          setProfileImage(userStore.profileImage || "");
          setProfilePreview("");
        } else if (userProfile) {
          setSettings(prev => ({
            ...prev,
            storeName: userProfile.displayName || "",
            contactEmail: userProfile.email || "",
          }));
        }
      } catch (error) {
        console.error("Error loading store data:", error);
      }
    }
  };

  useEffect(() => {
    loadStoreData();
  }, [user, userProfile]);

  const handleInputChange = (field: string, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!user || loading || bgUploading) return;
    setLoading(true);
    try {
      let bgUrl = backgroundImage;
      let logoUrl = storeData?.storeImage;
      let profileUrl = profileImage;
      // Handle background image upload
      if (newBackgroundFile) {
        setBgUploading(true);
        const uploadedUrl = await uploadToCloudinary(newBackgroundFile);
        bgUrl = uploadedUrl;
        logoUrl = uploadedUrl;
        setBackgroundImage(uploadedUrl);
        setBgUploading(false);
      }
      // Handle profile card image upload
      if (newProfileFile) {
        setProfileUploading(true);
        const uploadedUrl = await uploadToCloudinary(newProfileFile);
        profileUrl = uploadedUrl;
        setProfileImage(uploadedUrl);
        setProfileUploading(false);
      }
      // Update user profile if fullName or email changed
      if (
        (settings.fullName && settings.fullName !== userProfile?.displayName) ||
        (settings.email && settings.email !== userProfile?.email)
      ) {
        await updateUserProfile(user.uid, {
          displayName: settings.fullName,
          email: settings.email,
        });
      }
      // Always provide a valid storeImage (uploaded, existing, or default)
      let storeImage = logoUrl;
      if (!storeImage) {
        storeImage = "/placeholder.svg";
      }
      const storeInfo = {
        vendorId: user.uid,
        storeName: settings.storeName,
        storeDescription: settings.storeDescription,
        email: settings.contactEmail,
        phone: settings.contactPhone,
        address: settings.businessAddress,
        category: settings.storeCategory || "electronics",
        deliveryTime: settings.deliveryTime,
        deliveryFee: settings.deliveryFee,
        minimumOrder: settings.minimumOrder,
        returnPolicy: settings.returnPolicy,
        shippingPolicy: settings.shippingPolicy,
        acceptReturns: settings.acceptReturns,
        acceptExchanges: settings.acceptExchanges,
        autoFulfill: settings.autoFulfill,
        emailNotifications: settings.emailNotifications,
        backgroundImage: bgUrl,
        profileImage: profileUrl,
        isOpen: storeData?.isOpen ?? true,
        storeImage,
      };
      let saveSuccess = false;
      if (storeData) {
        // Update existing store
        console.log("PATCH payload:", storeInfo);
        const res = await fetch(`/api/database/stores/${storeData._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(storeInfo),
        });
        let data = {};
        if (res.ok) {
          const text = await res.text();
          data = text ? JSON.parse(text) : {};
        }
        console.log("PATCH response:", data);
        saveSuccess = (data as any).success;
      } else {
        // Create new store
        const res = await fetch(`/api/database/stores`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(storeInfo),
        });
        let data = {};
        if (res.ok) {
          const text = await res.text();
          data = text ? JSON.parse(text) : {};
        }
        saveSuccess = (data as any).success;
      }
      if (saveSuccess) {
        // Reload store data
        await loadStoreData();
        setNewBackgroundFile(null);
        showNotificationBox("Settings saved successfully!", "success");
      } else {
        showNotificationBox("Failed to save settings. Please try again.", "error");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      showNotificationBox("Failed to save settings. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <VendorLayout>
      <div className="container mx-auto py-10">
        <div className="flex flex-col md:flex-row gap-8">
          <form className="flex-1 space-y-8" onSubmit={e => { e.preventDefault(); handleSave(); }}>
            {/* Profile Information Card */}
            <Card id="profile-info">
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" value={settings.fullName} onChange={e => handleInputChange("fullName", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={settings.email} onChange={e => handleInputChange("email", e.target.value)} />
                </div>
              </CardContent>
            </Card>
            {/* Store Information Card */}
            <Card id="store-info">
              <CardHeader>
                <CardTitle>Store Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                  <Label htmlFor="businessAddress">Business Address</Label>
                                  <LocationPicker
                                        
                  value={settings.businessAddress}
                  onChange={val => handleInputChange("businessAddress", val)}
                  onLocationSelect={loc => handleInputChange("businessAddress", loc.address)}
                  placeholder="Search for your business location..."
                                      />
                                </div>
                <div>
                  <Label htmlFor="storeName">Store Name</Label>
                  <Input id="storeName" value={settings.storeName} onChange={e => handleInputChange("storeName", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="storeCategory">Store Category</Label>
                  <Select value={settings.storeCategory} onValueChange={val => handleInputChange("storeCategory", val)}>
                    <SelectTrigger id="storeCategory">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="electronics">Electronics</SelectItem>
                      <SelectItem value="fashion">Fashion</SelectItem>
                      <SelectItem value="food">Food & Beverages</SelectItem>
                      <SelectItem value="beauty">Beauty & Personal Care</SelectItem>
                      <SelectItem value="home">Home & Living</SelectItem>
                      <SelectItem value="sports">Sports & Fitness</SelectItem>
                      <SelectItem value="books">Books & Media</SelectItem>
                      <SelectItem value="toys">Toys & Games</SelectItem>
                      <SelectItem value="automotive">Automotive</SelectItem>
                      <SelectItem value="health">Health & Wellness</SelectItem>
                      <SelectItem value="services">Services</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="storeDescription">Store Description</Label>
                  <Textarea id="storeDescription" value={settings.storeDescription} onChange={e => handleInputChange("storeDescription", e.target.value)} rows={2} />
                </div>
                <div>
                  <Label htmlFor="minimumOrder">Minimum Order</Label>
                  <Input id="minimumOrder" type="number" value={settings.minimumOrder} onChange={e => handleInputChange("minimumOrder", Number(e.target.value))} />
                </div>
              </CardContent>
            </Card>
            {/* Branding Section */}
            <Card id="branding">
              <CardHeader>
                <CardTitle>Branding</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Store Profile Card Image (large background/profile photo) */}
                <div className="space-y-2">
                  <Label>Profile Card Image (Large)</Label>
                  {profileImage ? (
                    <img
                      src={profilePreview || profileImage}
                      alt="Profile Card"
                      className="w-full max-w-md h-40 object-cover rounded border"
                    />
                  ) : (
                    <div className="w-full max-w-md h-40 flex items-center justify-center bg-muted rounded border text-muted-foreground">
                      No profile card image set
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-upload">Change Profile Card Image</Label>
                  <Input
                    id="profile-upload"
                    type="file"
                    accept="image/*"
                    ref={profileInputRef}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        console.log('Profile image file selected:', file);
                        setNewProfileFile(file);
                        const url = URL.createObjectURL(file);
                        setProfilePreview(url);
                        console.log('Profile preview URL set:', url);
                      }
                    }}
                  />
                  {profilePreview && (
                    <div className="flex gap-2 mt-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setNewProfileFile(null);
                          setProfilePreview("");
                          if (profileInputRef.current) profileInputRef.current.value = "";
                        }}
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
                {profileUploading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="animate-spin h-4 w-4" /> Uploading image...
                  </div>
                )}
                {/* Store Background Image (for banner, etc) */}
                <div className="space-y-2">
                  <Label>Store Background Image</Label>
                  {(backgroundPreview || backgroundImage) ? (
                    <img
                      src={backgroundPreview || backgroundImage}
                      alt="Store Background"
                      className="w-full max-w-md h-40 object-cover rounded border"
                    />
                  ) : (
                    <div className="w-full max-w-md h-40 flex items-center justify-center bg-muted rounded border text-muted-foreground">
                      No background image set
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="background-upload">Change Background Image</Label>
                  <Input
                    id="background-upload"
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) {
                        console.log('Background image file selected:', file);
                        setNewBackgroundFile(file)
                        const url = URL.createObjectURL(file);
                        setBackgroundPreview(url)
                        console.log('Background preview URL set:', url);
                      }
                    }}
                  />
                  {backgroundPreview && (
                    <div className="flex gap-2 mt-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setNewBackgroundFile(null)
                          setBackgroundPreview("")
                          if (fileInputRef.current) fileInputRef.current.value = ""
                        }}
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
                {bgUploading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="animate-spin h-4 w-4" /> Uploading image...
                  </div>
                )}
              </CardContent>
            </Card>
            {/* Policies Section */}
            <Card id="policies">
              <CardHeader>
                <CardTitle>Store Policies</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="returnPolicy">Return Policy</Label>
                  <Textarea
                    id="returnPolicy"
                    value={settings.returnPolicy}
                    onChange={e => handleInputChange("returnPolicy", e.target.value)}
                    placeholder="Describe your return policy..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="shippingPolicy">Shipping Policy</Label>
                  <Textarea
                    id="shippingPolicy"
                    value={settings.shippingPolicy}
                    onChange={e => handleInputChange("shippingPolicy", e.target.value)}
                    placeholder="Describe your shipping policy..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
            {/* Preferences Section */}
            <Card id="preferences">
              <CardHeader>
                <CardTitle>Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Accept Returns</Label>
                    <p className="text-sm text-muted-foreground">Allow customers to return products</p>
                  </div>
                  <Switch
                    checked={settings.acceptReturns}
                    onCheckedChange={checked => handleInputChange("acceptReturns", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Accept Exchanges</Label>
                    <p className="text-sm text-muted-foreground">Allow customers to exchange products</p>
                  </div>
                  <Switch
                    checked={settings.acceptExchanges}
                    onCheckedChange={checked => handleInputChange("acceptExchanges", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto Fulfill Orders</Label>
                    <p className="text-sm text-muted-foreground">Automatically mark orders as fulfilled</p>
                  </div>
                  <Switch
                    checked={settings.autoFulfill}
                    onCheckedChange={checked => handleInputChange("autoFulfill", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive email notifications for orders</p>
                  </div>
                  <Switch
                    checked={settings.emailNotifications}
                    onCheckedChange={checked => handleInputChange("emailNotifications", checked)}
                  />
                </div>
              </CardContent>
            </Card>
            {/* Save Button (Sticky) */}
            <div className="sticky bottom-0 bg-background py-4 border-t flex justify-end z-10">
              <Button type="submit" disabled={loading || bgUploading} className="px-8 text-base font-semibold">
                {loading || bgUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
              {/* No virtual store warning needed */}
            </div>
          </form>
        </div>
      </div>
    <NotificationBox
      message={notification}
      show={showNotification}
      onClose={() => setShowNotification(false)}
      type={notificationType}
    />
      <NotificationBox
        message={notification}
        show={showNotification}
        onClose={() => setShowNotification(false)}
        type={notificationType}
      />
    </VendorLayout>
  )
}