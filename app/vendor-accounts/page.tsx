import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function VendorAccountsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Vendor Directory</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Browse our vendor directory to discover amazing stores and service providers.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              This section will show real vendors from the database once they register their businesses.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export const metadata = {
  title: 'Mock Vendor Accounts - Make It Sell Marketplace',
  description: 'Test login credentials for marketplace vendors and service providers'
}