"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, Mail, Users, AlertTriangle } from "lucide-react"

export default function MigrateUsersPage() {
  const [loading, setLoading] = useState(false)
  const [emailFilter, setEmailFilter] = useState("")
  const [adminKey, setAdminKey] = useState("")
  const [result, setResult] = useState<any>(null)
  const [userCount, setUserCount] = useState<any>(null)

  const checkUnverifiedUsers = async () => {
    if (!adminKey) {
      alert("Please enter admin key")
      return
    }

    setLoading(true)
    try {
      console.log('[admin-panel] Making request to check users...')
      const response = await fetch(`/api/admin/migrate-users?${emailFilter ? `filter=${emailFilter}` : ''}`, {
        headers: {
          'Authorization': `Bearer ${adminKey}`,
          'Content-Type': 'application/json'
        }
      })
      
      console.log('[admin-panel] Response status:', response.status)
      const data = await response.json()
      console.log('[admin-panel] Response data:', data)

      if (data.success) {
        setUserCount(data)
      } else {
        console.error('[admin-panel] Error:', data.error)
        alert(data.error)
      }
    } catch (error) {
      console.error('[admin-panel] Request failed:', error)
      alert("Failed to check users")
    } finally {
      setLoading(false)
    }
  }

  const runMigration = async () => {
    if (!adminKey) {
      alert("Please enter admin key")
      return
    }

    if (!confirm(`Are you sure you want to send verification emails to ${userCount?.count || 'all'} unverified users?`)) {
      return
    }

    setLoading(true)
    try {
      console.log('[admin-panel] Making migration request...')
      const response = await fetch('/api/admin/migrate-users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'migrate',
          emailFilter: emailFilter || undefined
        })
      })
      
      console.log('[admin-panel] Migration response status:', response.status)
      const data = await response.json()
      console.log('[admin-panel] Migration response data:', data)

      if (data.success) {
        setResult(data)
        setUserCount(null) // Clear count after migration
      } else {
        console.error('[admin-panel] Migration error:', data.error)
        alert(data.error)
      }
    } catch (error) {
      console.error('[admin-panel] Migration request failed:', error)
      alert("Migration failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-6 w-6" />
              Email Verification Migration
            </CardTitle>
            <CardDescription>
              Send verification emails to existing users who registered before email verification was implemented
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Admin Key</label>
                <Input
                  type="password"
                  placeholder="Enter admin key"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email Filter (Optional)</label>
                <Input
                  placeholder="e.g., @gmail.com or specific email"
                  value={emailFilter}
                  onChange={(e) => setEmailFilter(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={checkUnverifiedUsers}
                disabled={loading || !adminKey}
                variant="outline"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
                Check Unverified Users
              </Button>

              <Button
                onClick={runMigration}
                disabled={loading || !adminKey || !userCount}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                Send Verification Emails
              </Button>
            </div>

            {userCount && (
              <Alert className="border-blue-200 bg-blue-50">
                <Users className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <div className="font-semibold mb-2">Found {userCount.count} unverified users</div>
                  <div className="space-y-1">
                    {userCount.sample?.slice(0, 5).map((user: any, index: number) => (
                      <div key={index} className="text-sm flex items-center gap-2">
                        <Badge variant="outline">{user.email}</Badge>
                        <span className="text-gray-600">{user.name || 'No name'}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                    {userCount.count > 5 && (
                      <div className="text-sm text-gray-600">...and {userCount.count - 5} more</div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {result && (
              <Alert className={result.failed > 0 ? "border-yellow-200 bg-yellow-50" : "border-green-200 bg-green-50"}>
                <AlertTriangle className={`h-4 w-4 ${result.failed > 0 ? 'text-yellow-600' : 'text-green-600'}`} />
                <AlertDescription className={result.failed > 0 ? 'text-yellow-800' : 'text-green-800'}>
                  <div className="font-semibold mb-2">Migration Complete</div>
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div>
                      <div className="text-sm font-medium">Processed</div>
                      <div className="text-lg">{result.processed}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium">Successful</div>
                      <div className="text-lg text-green-600">{result.successful}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium">Failed</div>
                      <div className="text-lg text-red-600">{result.failed}</div>
                    </div>
                  </div>
                  
                  {result.hasMore && (
                    <div className="mb-2">
                      <Badge variant="outline" className="bg-blue-100">
                        {result.remaining} users remaining - run migration again to continue
                      </Badge>
                    </div>
                  )}

                  {result.failedEmails?.length > 0 && (
                    <div>
                      <div className="text-sm font-medium mb-1">Failed emails (first 10):</div>
                      <div className="space-y-1">
                        {result.failedEmails.map((email: string, index: number) => (
                          <Badge key={index} variant="outline" className="mr-1 mb-1 text-red-600 border-red-200">
                            {email}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">1. Check Users First</h4>
                <p className="text-gray-600">
                  Click "Check Unverified Users" to see how many users need verification emails. 
                  Use the email filter to target specific domains or users.
                </p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">2. Run Migration</h4>
                <p className="text-gray-600">
                  Click "Send Verification Emails" to send emails to all unverified users. 
                  The system processes 50 users at a time to avoid timeouts.
                </p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">3. Monitor Results</h4>
                <p className="text-gray-600">
                  Check the results summary for successful/failed emails. If there are remaining users, 
                  run the migration again to continue processing.
                </p>
              </div>

              <Alert className="border-orange-200 bg-orange-50">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  <strong>Important:</strong> This will send emails to all unverified users. 
                  Make sure your email service can handle the volume and that users are expecting these emails.
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}