"use client"

import { useState, useEffect } from "react"
import VendorLayout from "@/components/vendor/VendorLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { useAuth } from "@/contexts/AuthContext"
import { getStores, createStore, updateStore, type Store as StoreType } from "@/lib/firestore"
import { uploadToCloudinary } from "@/lib/cloudinary"
import { Store, Save, Upload, X, Loader2, Image } from "lucide-react"

export default function VendorStoreSettingsPage() {
  const { user, userProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [storeData, setStoreData] = useState<StoreType | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [additionalBannerFiles, setAdditionalBannerFiles] = useState<File[]>([])
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string | null>(null)
  const [additionalBannerPreviews, setAdditionalBannerPreviews] = useState<string[]>([])
  const [settings, setSettings] = useState({
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

  useEffect(() => {
    const loadStoreData = async () => {
      if (user) {
        try {
          const stores = await getStores({ limitCount: 1 })
          const userStore = stores.find(store => store.vendorId === user.uid)
          
          if (userStore) {
            setStoreData(userStore)
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
            }))
          } else if (userProfile) {
            // If no store exists, use user profile data
            setSettings(prev => ({
              ...prev,
              storeName: userProfile.displayName || "",
              contactEmail: userProfile.email || "",
            }))
          }
        } catch (error) {
          console.error("Error loading store data:", error)
        }
      }
    }

    loadStoreData()
  }, [user, userProfile])

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Logo file size must be less than 5MB")
        return
      }
      if (!file.type.startsWith('image/')) {
        alert("Please select a valid image file")
        return
      }
      setLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => setLogoPreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert("Banner file size must be less than 10MB")
        return
      }
      if (!file.type.startsWith('image/')) {
        alert("Please select a valid image file")
        return
      }
      setBannerFile(file)
      const reader = new FileReader()
      reader.onloadend = () => setBannerPreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const uploadLogo = async () => {
    if (!logoFile || !user) return null
    setUploading(true)
    try {
      const logoUrl = await uploadToCloudinary(logoFile)
      setLogoFile(null)
      setLogoPreview(null)
      return logoUrl
    } catch (error) {
      console.error("Error uploading logo:", error)
      throw error
    } finally {
      setUploading(false)
    }
  }

  const uploadBanner = async () => {
    if (!bannerFile || !user) return null
    setUploadingBanner(true)
    try {
      const bannerUrl = await uploadToCloudinary(bannerFile)
      setBannerFile(null)
      setBannerPreview(null)
      return bannerUrl
    } catch (error) {
      console.error("Error uploading banner:", error)
      throw error
    } finally {
      setUploadingBanner(false)
    }
  }

  const handleAdditionalBannersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const validFiles = files.filter(file => {
      if (file.size > 10 * 1024 * 1024) {
        alert(`${file.name} is too large. Maximum size is 10MB`)
        return false
      }
      if (!file.type.startsWith('image/')) {
        alert(`${file.name} is not a valid image file`)
        return false
      }
      return true
    })

    setAdditionalBannerFiles(prev => [...prev, ...validFiles])
    
    // Create previews
    validFiles.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setAdditionalBannerPreviews(prev => [...prev, reader.result as string])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeAdditionalBanner = (index: number) => {
    setAdditionalBannerFiles(prev => prev.filter((_, i) => i !== index))
    setAdditionalBannerPreviews(prev => prev.filter((_, i) => i !== index))
  }

  const uploadAdditionalBanners = async () => {
    if (additionalBannerFiles.length === 0) return []
    
    try {
      const uploadPromises = additionalBannerFiles.map(file => uploadToCloudinary(file))
      const urls = await Promise.all(uploadPromises)
      setAdditionalBannerFiles([])
      setAdditionalBannerPreviews([])
      return urls
    } catch (error) {
      console.error("Error uploading additional banners:", error)
      throw error
    }
  }

  const handleSave = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      let logoUrl = storeData?.storeImage
      let bannerUrl = storeData?.storeBanner

      // Upload new logo if selected
      if (logoFile) {
        const newLogoUrl = await uploadLogo()
        if (newLogoUrl) logoUrl = newLogoUrl
      }

      // Upload new banner if selected
      if (bannerFile) {
        const newBannerUrl = await uploadBanner()
        if (newBannerUrl) bannerUrl = newBannerUrl
      }

      // Upload additional banners
      const newAdditionalBanners = await uploadAdditionalBanners()
      const existingBanners = storeData?.bannerImages || []
      const allBanners = [...existingBanners, ...newAdditionalBanners]

      const storeInfo = {
        vendorId: user.uid,
        storeName: settings.storeName,
        storeDescription: settings.storeDescription,
        storeImage: logoUrl || "/placeholder.svg",
        storeBanner: bannerUrl,
        bannerImages: allBanners,
        category: settings.storeCategory || "electronics",
        rating: storeData?.rating || 5.0,
        reviewCount: storeData?.reviewCount || 0,
        isOpen: true,
        deliveryTime: settings.deliveryTime,
        deliveryFee: settings.deliveryFee,
        minimumOrder: settings.minimumOrder,
        address: settings.businessAddress,
        phone: settings.contactPhone,
        email: settings.contactEmail,
      }

      if (storeData) {
        // Update existing store
        await updateStore(storeData.id, storeInfo)
      } else {
        // Create new store
        await createStore(storeInfo)
      }

      alert("Settings saved successfully!")
      
      // Reload store data
      const stores = await getStores({ limitCount: 1 })
      const userStore = stores.find(store => store.vendorId === user.uid)
      if (userStore) {
        setStoreData(userStore)
      }
    } catch (error) {
      console.error("Error saving settings:", error)
      alert("Error saving settings: " + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <VendorLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Store Settings</h1>
          <p className="text-muted-foreground">Configure your store information and policies</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Store Information */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  Store Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="storeName">Store Name</Label>
                    <Input
                      id="storeName"
                      value={settings.storeName}
                      onChange={(e) => handleInputChange("storeName", e.target.value)}
                      placeholder="Your Store Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">Contact Email</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={settings.contactEmail}
                      onChange={(e) => handleInputChange("contactEmail", e.target.value)}
                      placeholder="contact@yourstore.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="storeDescription">Store Description</Label>
                  <Textarea
                    id="storeDescription"
                    value={settings.storeDescription}
                    onChange={(e) => handleInputChange("storeDescription", e.target.value)}
                    placeholder="Tell customers about your store..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactPhone">Contact Phone</Label>
                    <Input
                      id="contactPhone"
                      value={settings.contactPhone}
                      onChange={(e) => handleInputChange("contactPhone", e.target.value)}
                      placeholder="+234 812 938 0869"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="businessAddress">Business Address</Label>
                    <Input
                      id="businessAddress"
                      value={settings.businessAddress}
                      onChange={(e) => handleInputChange("businessAddress", e.target.value)}
                      placeholder="123 Allen Avenue, Lagos, Nigeria"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="storeCategory">Store Category</Label>
                    <select
                      id="storeCategory"
                      value={settings.storeCategory}
                      onChange={(e) => handleInputChange("storeCategory", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Select Category</option>
                      <option value="electronics">Electronics</option>
                      <option value="fashion">Fashion & Clothing</option>
                      <option value="food">Food & Beverage</option>
                      <option value="home">Home & Garden</option>
                      <option value="beauty">Beauty & Health</option>
                      <option value="sports">Sports & Fitness</option>
                      <option value="books">Books & Media</option>
                      <option value="automotive">Automotive</option>
                      <option value="toys">Toys & Games</option>
                      <option value="art">Arts & Crafts</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deliveryTime">Delivery Time</Label>
                    <Input
                      id="deliveryTime"
                      value={settings.deliveryTime}
                      onChange={(e) => handleInputChange("deliveryTime", e.target.value)}
                      placeholder="30-60 min"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deliveryFee">Delivery Fee (₦)</Label>
                    <Input
                      id="deliveryFee"
                      type="number"
                      value={settings.deliveryFee}
                      onChange={(e) => handleInputChange("deliveryFee", parseInt(e.target.value) || 0)}
                      placeholder="500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minimumOrder">Minimum Order (₦)</Label>
                  <Input
                    id="minimumOrder"
                    type="number"
                    value={settings.minimumOrder}
                    onChange={(e) => handleInputChange("minimumOrder", parseInt(e.target.value) || 0)}
                    placeholder="2000"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Policies */}
            <Card>
              <CardHeader>
                <CardTitle>Store Policies</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="returnPolicy">Return Policy</Label>
                  <Textarea
                    id="returnPolicy"
                    value={settings.returnPolicy}
                    onChange={(e) => handleInputChange("returnPolicy", e.target.value)}
                    placeholder="Describe your return policy..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shippingPolicy">Shipping Policy</Label>
                  <Textarea
                    id="shippingPolicy"
                    value={settings.shippingPolicy}
                    onChange={(e) => handleInputChange("shippingPolicy", e.target.value)}
                    placeholder="Describe your shipping policy..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Preferences */}
            <Card>
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
                    onCheckedChange={(checked) => handleInputChange("acceptReturns", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Accept Exchanges</Label>
                    <p className="text-sm text-muted-foreground">Allow customers to exchange products</p>
                  </div>
                  <Switch
                    checked={settings.acceptExchanges}
                    onCheckedChange={(checked) => handleInputChange("acceptExchanges", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto Fulfill Orders</Label>
                    <p className="text-sm text-muted-foreground">Automatically mark orders as fulfilled</p>
                  </div>
                  <Switch
                    checked={settings.autoFulfill}
                    onCheckedChange={(checked) => handleInputChange("autoFulfill", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive email notifications for orders</p>
                  </div>
                  <Switch
                    checked={settings.emailNotifications}
                    onCheckedChange={(checked) => handleInputChange("emailNotifications", checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Store Logo */}
            <Card>
              <CardHeader>
                <CardTitle>Store Logo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                  {logoPreview || storeData?.storeImage ? (
                    <img
                      src={logoPreview || storeData?.storeImage}
                      alt="Store logo"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Store className="h-12 w-12 text-gray-400" />
                  )}
                </div>
                <input
                  type="file"
                  id="logoUpload"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => document.getElementById('logoUpload')?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {uploading ? "Uploading..." : "Upload Logo"}
                </Button>
                {logoPreview && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setLogoFile(null)
                      setLogoPreview(null)
                    }}
                    className="w-full"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  Square image, max 5MB (JPG, PNG, GIF)
                </p>
              </CardContent>
            </Card>

            {/* Store Banner */}
            <Card>
              <CardHeader>
                <CardTitle>Store Banner</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                  {bannerPreview || storeData?.storeBanner ? (
                    <img
                      src={bannerPreview || storeData?.storeBanner}
                      alt="Store banner"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center">
                      <Image className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-xs text-gray-500">No banner</p>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  id="bannerUpload"
                  accept="image/*"
                  onChange={handleBannerChange}
                  className="hidden"
                />
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => document.getElementById('bannerUpload')?.click()}
                  disabled={uploadingBanner}
                >
                  {uploadingBanner ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {uploadingBanner ? "Uploading..." : "Upload Banner"}
                </Button>
                {bannerPreview && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setBannerFile(null)
                      setBannerPreview(null)
                    }}
                    className="w-full"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  Recommended: 1200x400px, max 10MB
                </p>
              </CardContent>
            </Card>

            {/* Additional Banners */}
            <Card>
              <CardHeader>
                <CardTitle>Additional Banner Images</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Upload multiple banner images for a slideshow (changes every 6 seconds)
                </p>
                
                {/* Existing banners from store */}
                {storeData?.bannerImages && storeData.bannerImages.length > 0 && (
                  <div className="space-y-2">
                    <Label>Current Additional Banners</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {storeData.bannerImages.map((url, index) => (
                        <div key={index} className="relative h-24 bg-gray-100 rounded-lg overflow-hidden">
                          <img src={url} alt={`Banner ${index + 1}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* New banner previews */}
                {additionalBannerPreviews.length > 0 && (
                  <div className="space-y-2">
                    <Label>New Banners to Upload</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {additionalBannerPreviews.map((preview, index) => (
                        <div key={index} className="relative h-24 bg-gray-100 rounded-lg overflow-hidden group">
                          <img src={preview} alt={`New banner ${index + 1}`} className="w-full h-full object-cover" />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeAdditionalBanner(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <input
                  type="file"
                  id="additionalBannersUpload"
                  accept="image/*"
                  multiple
                  onChange={handleAdditionalBannersChange}
                  className="hidden"
                />
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => document.getElementById('additionalBannersUpload')?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Add More Banners
                </Button>
                <p className="text-xs text-muted-foreground">
                  Select multiple images. Recommended: 1200x400px, max 10MB each
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <Button onClick={handleSave} disabled={loading || uploading || uploadingBanner} className="w-full">
                  {loading ? (
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
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </VendorLayout>
  )
}