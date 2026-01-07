"use client"

import { useState } from "react"
import VendorLayout from "@/components/vendor/VendorLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import ThemeSelect from "@/components/vendor/ThemeSelect"
import { useAuth } from "@/contexts/AuthContext"
import { Settings, Save, Shield, Bell, Palette, Globe, Trash2, AlertTriangle } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export default function VendorSettingsPage() {
    // Add next-themes logic
    const { setTheme } = require('next-themes').useTheme?.() || {};
  const { user, userProfile, logout } = useAuth()
  const [loading, setLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [confirmationText, setConfirmationText] = useState("")
  const [settings, setSettings] = useState({
    // Account Settings
    displayName: userProfile?.displayName || "",
    email: userProfile?.email || "",
    phone: "",

    // Notification Settings
    emailNotifications: true,
    orderNotifications: true,
    reviewNotifications: true,
    marketingEmails: false,

    // Privacy Settings
    profileVisibility: "public",
    showEmail: false,
    showPhone: false,

    // Security Settings
    twoFactorEnabled: false,
    sessionTimeout: "30",

    // Appearance Settings
    theme: "light",
    language: "en",
    timezone: "UTC-8",
  })

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
    if (field === "theme" && setTheme) {
      setTheme(value);
    }
  }

  const handleDeleteAccount = async () => {
    console.log("Delete button clicked")
    console.log("Confirmation text:", confirmationText)
    console.log("Trimmed confirmation text:", confirmationText.trim())
    console.log("Required text: 'DELETE MY ACCOUNT'")
    console.log("Match:", confirmationText.trim() === "DELETE MY ACCOUNT")
    
    if (confirmationText.trim() !== "DELETE MY ACCOUNT") {
      alert("Please type 'DELETE MY ACCOUNT' to confirm")
      return
    }

    console.log("Starting deletion process...")
    console.log("User:", user)
    
    setDeleteLoading(true)
    try {
      console.log("Sending delete request...")
      
      const response = await fetch('/api/vendor/delete-account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vendorId: user?.uid,
          userId: user?.uid
        })
      })

      console.log("Response status:", response.status)
      console.log("Response ok:", response.ok)
      
      const result = await response.json()
      console.log("Response data:", result)

      if (result.success) {
        alert("Your account and all associated data have been permanently deleted.")
        await logout()
        window.location.href = '/'
      } else {
        throw new Error(result.error || 'Failed to delete account')
      }
    } catch (error: any) {
      console.error('Account deletion error:', error)
      alert(`Failed to delete account: ${error.message}`)
    } finally {
      setDeleteLoading(false)
      setDeleteDialogOpen(false)
      setConfirmationText("")
    }
  }

  return (
    <VendorLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account settings and preferences</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Account Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Account Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      value={settings.displayName}
                      onChange={(e) => handleInputChange("displayName", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={settings.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={settings.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    placeholder="+234 812 938 0869"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Notification Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive email updates about your account</p>
                  </div>
                  <Switch
                    checked={settings.emailNotifications}
                    onCheckedChange={(checked) => handleInputChange("emailNotifications", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Order Notifications</Label>
                    <p className="text-sm text-muted-foreground">Get notified about new orders</p>
                  </div>
                  <Switch
                    checked={settings.orderNotifications}
                    onCheckedChange={(checked) => handleInputChange("orderNotifications", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Review Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive notifications about new reviews</p>
                  </div>
                  <Switch
                    checked={settings.reviewNotifications}
                    onCheckedChange={(checked) => handleInputChange("reviewNotifications", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Marketing Emails</Label>
                    <p className="text-sm text-muted-foreground">Receive promotional emails and updates</p>
                  </div>
                  <Switch
                    checked={settings.marketingEmails}
                    onCheckedChange={(checked) => handleInputChange("marketingEmails", checked)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Privacy Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Privacy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Profile Visibility</Label>
                  <Select
                    value={settings.profileVisibility}
                    onValueChange={(value) => handleInputChange("profileVisibility", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                      <SelectItem value="vendors-only">Vendors Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Show Email Address</Label>
                    <p className="text-sm text-muted-foreground">Display your email on your public profile</p>
                  </div>
                  <Switch
                    checked={settings.showEmail}
                    onCheckedChange={(checked) => handleInputChange("showEmail", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Show Phone Number</Label>
                    <p className="text-sm text-muted-foreground">Display your phone on your public profile</p>
                  </div>
                  <Switch
                    checked={settings.showPhone}
                    onCheckedChange={(checked) => handleInputChange("showPhone", checked)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Appearance Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Appearance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Theme</Label>
                    <ThemeSelect value={settings.theme} onValueChange={v => handleInputChange("theme", v)} />
                  </div>

                  <div className="space-y-2">
                    <Label>Language</Label>
                    <Select
                      value={settings.language}
                      onValueChange={(value) => handleInputChange("language", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select
                      value={settings.timezone}
                      onValueChange={(value) => handleInputChange("timezone", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC-8">Pacific Time</SelectItem>
                        <SelectItem value="UTC-5">Eastern Time</SelectItem>
                        <SelectItem value="UTC+0">GMT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Security</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Two-Factor Authentication</Label>
                    <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                  </div>
                  <Switch
                    checked={settings.twoFactorEnabled}
                    onCheckedChange={(checked) => handleInputChange("twoFactorEnabled", checked)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Session Timeout</Label>
                  <Select
                    value={settings.sessionTimeout}
                    onValueChange={(value) => handleInputChange("sessionTimeout", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="240">4 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Danger Zone - Delete Account */}
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Danger Zone
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                  <h3 className="font-semibold text-destructive mb-2">Delete Account & Store</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Permanently delete your vendor account, store, and all associated data. This action cannot be undone.
                  </p>
                  
                  <div className="text-sm text-muted-foreground mb-4">
                    <p className="font-medium mb-2">This will permanently delete:</p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>Your store and all products</li>
                      <li>All services and bookings</li>
                      <li>Order history and customer conversations</li>
                      <li>Your vendor account and profile</li>
                      <li>All associated data and analytics</li>
                    </ul>
                  </div>

                  <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="destructive" className="w-full">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Account & Store
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                          <AlertTriangle className="h-5 w-5" />
                          Delete Account & Store
                        </DialogTitle>
                        <DialogDescription>
                          This action cannot be undone. This will permanently delete your vendor account, 
                          store, and all associated data including products, orders, and customer conversations.
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-4">
                        <div className="p-3 border border-destructive/20 rounded bg-destructive/5">
                          <p className="text-sm font-medium text-destructive mb-2">
                            All of the following will be permanently deleted:
                          </p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            <li>• Your store "{userProfile?.vendorInfo?.businessName || 'Your Store'}"</li>
                            <li>• All products and services</li>
                            <li>• Order history and analytics</li>
                            <li>• Customer conversations and bookings</li>
                            <li>• Your vendor account and profile</li>
                          </ul>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="confirmation">
                            Type <strong>DELETE MY ACCOUNT</strong> to confirm:
                          </Label>
                          <Input
                            id="confirmation"
                            value={confirmationText}
                            onChange={(e) => setConfirmationText(e.target.value)}
                            placeholder="DELETE MY ACCOUNT"
                          />
                        </div>
                      </div>

                      <DialogFooter className="gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setDeleteDialogOpen(false)
                            setConfirmationText("")
                          }}
                        >
                          Cancel
                        </Button>
                        <Button 
                          variant="destructive" 
                          onClick={handleDeleteAccount}
                          disabled={deleteLoading || confirmationText.trim() !== "DELETE MY ACCOUNT"}
                        >
                          {deleteLoading ? "Deleting..." : "Delete Forever"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
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