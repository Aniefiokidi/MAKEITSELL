"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { getProductById, deleteProduct } from "@/lib/firestore"
import VendorLayout from "@/components/vendor/VendorLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Image from "next/image"

export default function ProductViewPage() {
  const router = useRouter()
  const params = useParams()
  const { id } = params as { id: string }
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function fetchProduct() {
      setLoading(true)
      try {
        const prod = await getProductById(id)
        setProduct(prod)
      } catch (err: any) {
        setError("Product not found")
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchProduct()
  }, [id])

  const handleDelete = async () => {
    if (!id) return
    if (!confirm("Are you sure you want to delete this product?")) return
    try {
      await deleteProduct(id)
      router.push("/vendor/products")
    } catch (err) {
      setError("Failed to delete product")
    }
  }

  if (loading) return <div className="p-8">Loading...</div>
  if (error) return <div className="p-8 text-red-500">{error}</div>
  if (!product) return null

  return (
    <VendorLayout>
      <div className="max-w-2xl mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>{product.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-shrink-0 w-48 h-48 relative">
                <Image src={product.images?.[0] || "/placeholder.svg"} alt={product.title} fill className="object-cover rounded" />
              </div>
              <div className="flex-1 space-y-2">
                <div><b>Category:</b> {product.category}</div>
                <div><b>Price:</b> ₦{product.price}</div>
                <div><b>Stock:</b> {product.stock}</div>
                <div><b>SKU:</b> {product.sku}</div>
                <div><b>Description:</b> {product.description}</div>
                <div className="flex gap-2 mt-4">
                  <Button onClick={() => router.push(`/vendor/products/${id}/edit`)}>Edit</Button>
                  <Button variant="destructive" onClick={handleDelete}>Delete</Button>
                  <Button variant="outline" onClick={() => router.push("/vendor/products")}>Back</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </VendorLayout>
  )
}
