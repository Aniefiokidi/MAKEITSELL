"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { getProductById, updateProduct } from "@/lib/firestore"
import VendorLayout from "@/components/vendor/VendorLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Image from "next/image"

export default function ProductEditPage() {
  const router = useRouter()
  const params = useParams()
  const { id } = params as { id: string }
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [form, setForm] = useState<any>({})

  useEffect(() => {
    async function fetchProduct() {
      setLoading(true)
      try {
        const prod:any = await getProductById(id)
        setProduct(prod)
        setForm({
          title: prod.title,
          description: prod.description,
          price: prod.price,
          category: prod.category,
          stock: prod.stock,
          sku: prod.sku,
        })
      } catch (err: any) {
        setError("Product not found")
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchProduct()
  }, [id])

  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    try {
      await updateProduct(id, form)
      router.push(`/vendor/products/${id}`)
    } catch (err) {
      setError("Failed to update product")
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
            <CardTitle>Edit Product</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label>Title</label>
                <input name="title" value={form.title} onChange={handleChange} className="w-full border p-2 rounded" />
              </div>
              <div>
                <label>Description</label>
                <textarea name="description" value={form.description} onChange={handleChange} className="w-full border p-2 rounded" />
              </div>
              <div>
                <label>Price</label>
                <input name="price" type="number" value={form.price} onChange={handleChange} className="w-full border p-2 rounded" />
              </div>
              <div>
                <label>Category</label>
                <input name="category" value={form.category} onChange={handleChange} className="w-full border p-2 rounded" />
              </div>
              <div>
                <label>Stock</label>
                <input name="stock" type="number" value={form.stock} onChange={handleChange} className="w-full border p-2 rounded" />
              </div>
              <div>
                <label>SKU</label>
                <input name="sku" value={form.sku} onChange={handleChange} className="w-full border p-2 rounded" />
              </div>
              <div className="flex gap-2 mt-4">
                <Button type="submit">Save</Button>
                <Button variant="outline" onClick={() => router.push(`/vendor/products/${id}`)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </VendorLayout>
  )
}
