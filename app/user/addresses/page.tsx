"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { MapPin, Plus, Pencil, Trash2, Star, ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"
import { NIGERIA_STATE_CITY_OPTIONS, NIGERIA_STATES } from "@/lib/nigeria-locations"

const COUNTRY_CODES = [
  { code: "+234", label: "NG (+234)" },
  { code: "+233", label: "GH (+233)" },
  { code: "+254", label: "KE (+254)" },
  { code: "+27", label: "ZA (+27)" },
  { code: "+1", label: "US/CA (+1)" },
  { code: "+44", label: "UK (+44)" },
]

interface SavedAddress {
  _id: string
  label: string
  firstName: string
  lastName: string
  phoneCountryCode: string
  phone: string
  address: string
  city: string
  state: string
  zipCode: string
  deliveryInstructions: string
  isDefault: boolean
}

const EMPTY_FORM = {
  label: "", firstName: "", lastName: "", phoneCountryCode: "+234", phone: "",
  address: "", city: "", state: "", zipCode: "", deliveryInstructions: "", isDefault: false,
}

export default function AddressesPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    if (!user) {
      router.push("/login")
      return
    }
    fetch("/api/user/addresses")
      .then((res) => res.json())
      .then((data) => setAddresses(data.addresses || []))
      .finally(() => setLoading(false))
  }, [user, router])

  const availableCities = useMemo(() => NIGERIA_STATE_CITY_OPTIONS[form.state] || [], [form.state])

  const handleField = (field: keyof typeof EMPTY_FORM, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const openAddDialog = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEditDialog = (addr: SavedAddress) => {
    setEditingId(addr._id)
    setForm({
      label: addr.label, firstName: addr.firstName, lastName: addr.lastName,
      phoneCountryCode: addr.phoneCountryCode || "+234", phone: addr.phone,
      address: addr.address, city: addr.city, state: addr.state,
      zipCode: addr.zipCode || "", deliveryInstructions: addr.deliveryInstructions || "",
      isDefault: addr.isDefault,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.label.trim() || !form.address.trim() || !form.city || !form.state) {
      setMessage({ type: "error", text: "Label, address, city, and state are required." })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch(editingId ? `/api/user/addresses/${editingId}` : "/api/user/addresses", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to save address")
      setAddresses(data.addresses || [])
      setDialogOpen(false)
      setMessage({ type: "success", text: editingId ? "Address updated." : "Address saved." })
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message || "Failed to save address." })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/user/addresses/${id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to delete address")
      setAddresses(data.addresses || [])
      setMessage({ type: "success", text: "Address deleted." })
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message || "Failed to delete address." })
    }
  }

  const handleSetDefault = async (id: string) => {
    try {
      const res = await fetch(`/api/user/addresses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to set default")
      setAddresses(data.addresses || [])
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message || "Failed to set default address." })
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <Header />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/user/settings"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold">My Addresses</h1>
              <p className="text-xs text-muted-foreground">Saved delivery addresses for faster checkout</p>
            </div>
          </div>
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Address
          </Button>
        </div>

        {message && (
          <Alert variant={message.type === "error" ? "destructive" : "default"} className="mb-4">
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : addresses.length === 0 ? (
          <div className="text-center py-24 space-y-4">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
              <MapPin className="h-7 w-7 text-accent" />
            </div>
            <p className="font-semibold text-lg">No saved addresses yet</p>
            <p className="text-muted-foreground text-sm">Save a delivery address to speed up checkout next time.</p>
            <Button onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add your first address
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {addresses.map((addr) => (
              <div key={addr._id} className="bg-card rounded-2xl border border-border/50 shadow-sm p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{addr.label}</span>
                    {addr.isDefault && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                        <Star className="h-3 w-3 fill-accent" /> Default
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditDialog(addr)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive hover:text-white">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete "{addr.label}"?</AlertDialogTitle>
                          <AlertDialogDescription>This saved address will be removed. This can't be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(addr._id)} className="bg-destructive hover:bg-destructive/90">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground space-y-0.5">
                  {(addr.firstName || addr.lastName) && <p className="text-foreground">{addr.firstName} {addr.lastName}</p>}
                  <p>{addr.address}</p>
                  <p>{addr.city}, {addr.state} {addr.zipCode}</p>
                  {addr.phone && <p>{addr.phoneCountryCode} {addr.phone}</p>}
                </div>
                {!addr.isDefault && (
                  <Button size="sm" variant="outline" className="w-full" onClick={() => handleSetDefault(addr._id)}>
                    Set as default
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Address" : "Add Address"}</DialogTitle>
            <DialogDescription>Save your delivery details for faster checkout.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="addr-label">Label *</Label>
              <Input id="addr-label" placeholder="e.g. Home, Office" value={form.label} onChange={(e) => handleField("label", e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="addr-firstName">First Name</Label>
                <Input id="addr-firstName" value={form.firstName} onChange={(e) => handleField("firstName", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addr-lastName">Last Name</Label>
                <Input id="addr-lastName" value={form.lastName} onChange={(e) => handleField("lastName", e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-[auto_1fr] gap-2">
              <div className="space-y-2">
                <Label>Code</Label>
                <Select value={form.phoneCountryCode} onValueChange={(v) => handleField("phoneCountryCode", v)}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COUNTRY_CODES.map((c) => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="addr-phone">Phone</Label>
                <Input id="addr-phone" value={form.phone} onChange={(e) => handleField("phone", e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="addr-address">Address *</Label>
              <Input id="addr-address" value={form.address} onChange={(e) => handleField("address", e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>State *</Label>
                <Select value={form.state} onValueChange={(v) => { handleField("state", v); handleField("city", "") }}>
                  <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                  <SelectContent>
                    {NIGERIA_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>City *</Label>
                <Select value={form.city} onValueChange={(v) => handleField("city", v)} disabled={!form.state}>
                  <SelectTrigger><SelectValue placeholder={form.state ? "Select city" : "Select state first"} /></SelectTrigger>
                  <SelectContent>
                    {availableCities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="addr-zip">ZIP Code (optional)</Label>
              <Input id="addr-zip" value={form.zipCode} onChange={(e) => handleField("zipCode", e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="addr-instructions">Delivery Instructions</Label>
              <Textarea id="addr-instructions" rows={3} placeholder="Landmark or drop-off note for rider" value={form.deliveryInstructions} onChange={(e) => handleField("deliveryInstructions", e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? "Save Changes" : "Add Address"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
