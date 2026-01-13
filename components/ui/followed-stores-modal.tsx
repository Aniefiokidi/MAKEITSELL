import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { X, Heart } from "lucide-react"
import Link from "next/link"

interface FollowedStore {
  _id: string
  storeId: string
  storeName: string
  storeImage: string
  storeDescription: string
  category: string
}

interface FollowedStoresModalProps {
  open: boolean
  onClose: () => void
  userId: string
}

export function FollowedStoresModal({ open, onClose, userId }: FollowedStoresModalProps) {
  const [stores, setStores] = useState<FollowedStore[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      fetchFollowedStores()
    }
  }, [open])

  const fetchFollowedStores = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/user/followed-stores?userId=${userId}`)
      const data = await response.json()

      if (data.success) {
        setStores(data.data || [])
      } else {
        setError(data.error || "Failed to load followed stores")
      }
    } catch (err) {
      console.error("Error fetching followed stores:", err)
      setError("Failed to load followed stores")
    } finally {
      setLoading(false)
    }
  }

  const handleUnfollow = async (storeId: string) => {
    try {
      const response = await fetch("/api/store/follow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          storeId,
          customerId: userId,
          action: "unfollow",
        }),
      })

      const data = await response.json()

      if (data.success) {
        setStores(stores.filter((s) => s.storeId !== storeId))
      }
    } catch (err) {
      console.error("Error unfollowing store:", err)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-accent fill-accent" />
            Followed Stores ({stores.length})
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-muted-foreground">{error}</div>
        ) : stores.length === 0 ? (
          <div className="py-12 text-center">
            <Heart className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">You haven't followed any stores yet</p>
            <Link href="/stores">
              <Button className="hover:bg-accent/80 hover:scale-105 transition-all">
                Browse Stores
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {stores.map((store) => (
              <div
                key={store.storeId}
                className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/5 transition-all group"
              >
                {/* Store Logo */}
                <Avatar className="h-16 w-16 flex-shrink-0 border-2 border-accent/20 group-hover:border-accent/40 transition-colors">
                  <AvatarImage src={store.storeImage} alt={store.storeName} />
                  <AvatarFallback className="bg-accent/10 text-accent font-bold">
                    {store.storeName.charAt(0)}
                  </AvatarFallback>
                </Avatar>

                {/* Store Info */}
                <div className="flex-1 min-w-0">
                  <Link href={`/store/${store.storeId}`}>
                    <h3 className="font-semibold text-base line-clamp-1 hover:text-accent transition-colors cursor-pointer">
                      {store.storeName}
                    </h3>
                  </Link>
                  <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                    {store.storeDescription}
                  </p>
                  <Badge variant="outline" className="text-xs">
                    {store.category}
                  </Badge>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 flex-shrink-0">
                  <Link href={`/store/${store.storeId}`}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="hover:bg-accent/10 hover:text-accent transition-all"
                    >
                      Visit Store
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-accent hover:bg-accent/10 hover:text-accent/80 transition-all"
                    onClick={() => handleUnfollow(store.storeId)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
