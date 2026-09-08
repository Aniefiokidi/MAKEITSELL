"use client"

import { useCallback, useEffect, useState } from "react"
import AdminLayout from "@/components/admin/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { UserCheck } from "lucide-react"

const INCOME_LABELS: Record<string, string> = {
  under_50k: "Under ₦50k / month",
  "50k_200k": "₦50k – ₦200k / month",
  "200k_1m": "₦200k – ₦1m / month",
  over_1m: "Over ₦1m / month",
}

interface VendorApplication {
  _id: string
  userId: string
  status: "pending" | "approved" | "rejected"
  vendorType: string
  whatTheyPlanToSell: string
  expectedMonthlyIncome: string
  nin: string
  proofOfAddressUrl: string
  submittedAt: string
  applicantName: string | null
  applicantEmail: string | null
}

export default function AdminVendorApplicationsPage() {
  const [applications, setApplications] = useState<VendorApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch("/api/admin/vendor-applications?status=pending", { credentials: "include" })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Failed to load vendor applications")
      setApplications(json.applications || [])
    } catch (err: any) {
      setError(err.message || "Failed to load vendor applications")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleApprove = async (application: VendorApplication) => {
    if (
      !confirm(
        `${application.applicantName || application.applicantEmail || "This account"} will immediately become an active vendor. Approve?`
      )
    ) {
      return
    }
    setActingId(application._id)
    try {
      const res = await fetch("/api/admin/vendor-applications", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", applicationId: application._id }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Could not approve this application.")
      await load()
    } catch (err: any) {
      alert(err.message || "Could not approve this application.")
    } finally {
      setActingId(null)
    }
  }

  const confirmReject = async (application: VendorApplication) => {
    setActingId(application._id)
    try {
      const res = await fetch("/api/admin/vendor-applications", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          applicationId: application._id,
          rejectionReason: rejectionReason.trim(),
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Could not reject this application.")
      setRejectingId(null)
      setRejectionReason("")
      await load()
    } catch (err: any) {
      alert(err.message || "Could not reject this application.")
    } finally {
      setActingId(null)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Vendor Applications</h1>
          <p className="text-muted-foreground text-sm lg:text-base">
            Review and approve or reject pending vendor applications submitted from the app.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12 text-muted-foreground text-sm">Loading applications...</div>
        ) : error ? (
          <Card>
            <CardHeader>
              <CardTitle>Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        ) : applications.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <UserCheck className="h-10 w-10 text-muted-foreground/50" strokeWidth={1.5} />
              <p className="font-semibold">No pending applications</p>
              <p className="text-sm text-muted-foreground">Every vendor application has been reviewed.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {applications.map((app) => {
              const isActing = actingId === app._id
              const isRejecting = rejectingId === app._id
              return (
                <Card key={app._id}>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">{app.applicantName || "Applicant"}</CardTitle>
                      <Badge variant="secondary" className="capitalize">
                        {app.vendorType}
                      </Badge>
                    </div>
                    {app.applicantEmail && (
                      <p className="text-xs text-muted-foreground">{app.applicantEmail}</p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        Plans to sell
                      </p>
                      <p className="mt-1 text-sm font-medium">{app.whatTheyPlanToSell}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          Expected income
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          {INCOME_LABELS[app.expectedMonthlyIncome] || app.expectedMonthlyIncome}
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">NIN</p>
                        <p className="mt-1 text-sm font-medium">{app.nin}</p>
                      </div>
                    </div>

                    <a
                      href={app.proofOfAddressUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-lg bg-muted/50 p-2 hover:bg-muted transition-colors"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={app.proofOfAddressUrl}
                        alt="Proof of address"
                        className="h-10 w-10 rounded object-cover bg-muted"
                      />
                      <span className="text-sm font-semibold text-accent">View proof of address</span>
                    </a>

                    {isRejecting ? (
                      <div className="space-y-3 pt-1">
                        <Textarea
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="Reason for rejecting (shown to the applicant)"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                              setRejectingId(null)
                              setRejectionReason("")
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            className="flex-1"
                            onClick={() => confirmReject(app)}
                            disabled={isActing}
                          >
                            {isActing ? "Rejecting..." : "Confirm Reject"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="outline"
                          className="flex-1 border-destructive text-destructive hover:bg-destructive/10"
                          onClick={() => setRejectingId(app._id)}
                          disabled={isActing}
                        >
                          Reject
                        </Button>
                        <Button
                          className="flex-1 bg-accent hover:bg-accent/90"
                          onClick={() => handleApprove(app)}
                          disabled={isActing}
                        >
                          {isActing ? "Approving..." : "Approve"}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
