"use client";

import AdminLayout from "@/components/admin/AdminLayout";
import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";


interface VendorBankDetails {
  _id?: string;
  id?: string;
  vendorName?: string;
  ownerName?: string;
  owner?: string;
  vendorId?: string;
  storeName?: string;
  name?: string;
  bankName?: string;
  bankCode?: string;
  accountNumber?: string;
  accountName?: string;
  accountVerified?: boolean;
}

export default function AdminVendorsBankDetailsPage() {
  const [vendors, setVendors] = useState<VendorBankDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchVendors() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/database/stores");
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setVendors(data.data);
        } else {
          setError("Failed to load vendors");
        }
      } catch (err) {
        setError("Failed to load vendors");
      } finally {
        setLoading(false);
      }
    }
    fetchVendors();
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Vendors & Bank Details</h1>
          <p className="text-muted-foreground text-sm lg:text-base">View all vendor payout details and bank accounts</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base lg:text-lg">All Vendors ({vendors.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-accent rounded-full"></div>
              </div>
            ) : error ? (
              <div className="text-red-600">{error}</div>
            ) : vendors.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No vendors found</div>
            ) : (
                <>
                
              {/* Responsive: Table for desktop, stacked cards for mobile */}
              <div className="block md:hidden space-y-4">
                {vendors.map((store) => (
                  <div key={store._id || store.id} className="rounded-lg border bg-background p-4 shadow-sm">
                    <div className="font-semibold text-base mb-1">{store.storeName || store.name}</div>
                    <div className="text-xs text-muted-foreground mb-2">Vendor: {store.vendorName || store.ownerName || store.owner || store.vendorId || "-"}</div>
                    <div className="flex flex-col gap-1 text-sm">
                      <div><span className="font-medium">Bank:</span> {store.bankName || "-"}</div>
                      <div><span className="font-medium">Account Number:</span> {store.accountNumber || "-"}</div>
                      <div><span className="font-medium">Account Name:</span> {store.accountName || "-"}</div>
                      <div>
                        <span className="font-medium">Verified:</span> {store.accountVerified ? (
                          <span className="text-green-600 font-semibold">Yes</span>
                        ) : (
                          <span className="text-red-600">No</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Vendor</TableHead>
                      <TableHead className="text-xs">Store Name</TableHead>
                      <TableHead className="text-xs">Bank Name</TableHead>
                      <TableHead className="text-xs">Account Number</TableHead>
                      <TableHead className="text-xs">Account Name</TableHead>
                      <TableHead className="text-xs">Verified</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendors.map((store) => (
                      <TableRow key={store._id || store.id}>
                        <TableCell className="font-mono text-xs">{store.vendorName || store.ownerName || store.owner || store.vendorId || "-"}</TableCell>
                        <TableCell className="text-xs">{store.storeName || store.name}</TableCell>
                        <TableCell className="text-xs">{store.bankName || "-"}</TableCell>
                        <TableCell className="text-xs">{store.accountNumber || "-"}</TableCell>
                        <TableCell className="text-xs">{store.accountName || "-"}</TableCell>
                        <TableCell className="text-xs">
                          {store.accountVerified ? (
                            <span className="text-green-600 font-semibold">Yes</span>
                          ) : (
                            <span className="text-red-600">No</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
                </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
