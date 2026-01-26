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
              <div className="overflow-x-auto">
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
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
