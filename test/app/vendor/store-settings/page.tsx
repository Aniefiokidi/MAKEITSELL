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
import { Store, Save, Upload } from "lucide-react"

export default function VendorStoreSettingsPage() {
  const { user, userProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState({
    storeName: "",
    storeDescription: "",
    contactEmail: "",
    contactPhone: "",
    businessAddress: "",
    returnPolicy: "",
    shippingPolicy: "",
    acceptReturns: true,
    acceptExchanges: true,
    autoFulfill: false,
    emailNotifications: true,
  })

  useEffect(() => {
    // Load existing settings
    if (userProfile) {
      setSettings(prev => ({
        ...prev,
        storeName: userProfile.displayName || "",
        contactEmail: userProfile.email || "",
      }))
    }
  }, [userProfile])

  const handleSave = async () => {
    setLoading(true)
    try {
      // Here you would save to Firestore
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
      alert("Settings saved successfully!")
    } catch (error) {
      console.error("Error saving settings:", error)
      alert("Error saving settings")
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
            <Card>
              <CardHeader>
                <CardTitle>Store Logo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Store className="h-12 w-12 text-gray-400" />
                </div>
                <Button variant="outline" className="w-full">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Logo
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <Button onClick={handleSave} disabled={loading} className="w-full">
                  {loading ? (
                    "Saving..."
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