"use client"

import AdminLayout from "@/components/admin/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AdminSettingsPage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground text-sm lg:text-base">Configure admin preferences and controls.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base lg:text-lg">Coming Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">Settings will be managed here.</p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
