"use client";
import AdminLayout from "@/components/admin/AdminLayout";
import { useEffect, useState } from "react";

export default function AdminVendorsBankDetailsPage() {
  const [vendors, setVendors] = useState([]);
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
      <div className="py-6">
        <h1 className="text-2xl font-bold mb-6">Vendors & Bank Details</h1>
        {loading ? (
          <div>Loading...</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-700 bg-background">
              <thead>
                <tr className="bg-muted">
                  <th className="px-4 py-2 border-b text-left">Vendor Name</th>
                  <th className="px-4 py-2 border-b text-left">Store Name</th>
                  <th className="px-4 py-2 border-b text-left">Bank Name</th>
                  <th className="px-4 py-2 border-b text-left">Account Number</th>
                  <th className="px-4 py-2 border-b text-left">Account Name</th>
                  <th className="px-4 py-2 border-b text-left">Verified</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((store) => (
                  <tr key={store._id} className="border-b border-gray-700">
                    <td className="px-4 py-2">{store.vendorName || store.ownerName || store.owner || store.vendorId || "-"}</td>
                    <td className="px-4 py-2">{store.storeName}</td>
                    <td className="px-4 py-2">{store.bankName || "-"}</td>
                    <td className="px-4 py-2">{store.accountNumber || "-"}</td>
                    <td className="px-4 py-2">{store.accountName || "-"}</td>
                    <td className="px-4 py-2">
                      {store.accountVerified ? (
                        <span className="text-green-600 font-semibold">Yes</span>
                      ) : (
                        <span className="text-red-600">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
