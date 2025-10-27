"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog"
import { getServiceById, Service, createConversation, getConversations } from "@/lib/firestore"
import { useAuth } from "@/contexts/AuthContext"
import { ArrowLeft, MapPin, Clock, DollarSign, Star, Calendar, MessageCircle, CheckCircle, X, ChevronLeft, ChevronRight } from "lucide-react"
import BookingModal from "@/components/services/BookingModal"
import { Timestamp } from "firebase/firestore"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"

export default function ServiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, userProfile } = useAuth()
  const [service, setService] = useState<Service | null>(null)
  const [loading, setLoading] = useState(true)
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [selectedImage, setSelectedImage] = useState(0)
  const [messagingProvider, setMessagingProvider] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)
  const [modalImageIndex, setModalImageIndex] = useState(0)

  useEffect(() => {
    fetchService()
  }, [params.id])

  const fetchService = async () => {
    try {
      setLoading(true)
      const data = await getServiceById(params.id as string)
      setService(data)
    } catch (error) {
      console.error("Error fetching service:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleMessageProvider = async () => {
    if (!user || !userProfile) {
      router.push("/login")
      return
    }

    if (!service) return

    try {
      setMessagingProvider(true)
      
      // Check if conversation already exists
      const existingConversations = await getConversations(user.uid, "customer")
      const existingConv = existingConversations.find(
        conv => conv.providerId === service.providerId && conv.serviceId === service.id
      )

      if (existingConv) {
        // Navigate to existing conversation
        router.push("/messages")
      } else {
        // Create new conversation
        const conversationData = {
          customerId: user.uid,
          customerName: userProfile.displayName,
          providerId: service.providerId,
          providerName: service.providerName,
          serviceId: service.id,
          storeName: service.providerName,
          storeImage: service.providerImage,
          lastMessage: "Interested in your service",
          lastMessageTime: Timestamp.now(),
          unreadCount: 0,
        }

        await createConversation(conversationData)
        router.push("/messages")
      }
    } catch (error) {
      console.error("Error creating conversation:", error)
    } finally {
      setMessagingProvider(false)
    }
  }

  const getPriceDisplay = () => {
    if (!service) return ""
    const priceTypeMap = {
      fixed: "",
      hourly: "/hr",
      "per-session": "/session",
      custom: "",
    }
    return `$${service.price}${priceTypeMap[service.pricingType]}`
  }

  const getAvailabilityDays = () => {
    if (!service) return []
    return Object.entries(service.availability || {})
      .filter(([_, value]: [string, any]) => value.available)
      .map(([day]) => day.charAt(0).toUpperCase() + day.slice(1))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-8">
            <div className="h-96 bg-muted rounded-lg" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <div className="h-8 bg-muted rounded w-3/4" />
                <div className="h-32 bg-muted rounded" />
              </div>
              <div className="h-64 bg-muted rounded" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (!service) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Service not found</h1>
          <Button onClick={() => router.push("/services")}>Browse Services</Button>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      {/* Full Width Banner Section - matching store style */}
      <div className="relative w-full h-[500px] overflow-hidden">
        {/* Service Image Banner */}
        <img
          src={service.images && service.images.length > 0 ? service.images[selectedImage] : "/placeholder.svg"}
          alt={service.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" style={{ zIndex: 2 }} />
        
        {/* Bottom Fade to White */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" style={{ zIndex: 3 }} />
        
        {/* Content Overlay */}
        <div className="absolute inset-0 flex flex-col justify-end" style={{ zIndex: 4 }}>
          <div className="container mx-auto px-4 pb-8">
            {/* Back Button */}
            <Button
              variant="ghost"
              className="mb-4 text-white hover:bg-white/20 backdrop-blur-sm"
              onClick={() => router.push("/services")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Services
            </Button>

            <div className="flex items-end justify-between gap-8">
              <div className="text-white">
                <h1 className="text-4xl md:text-5xl font-bold mb-2">{service.title}</h1>
                <p className="text-lg text-white/90 mb-4">{service.providerName}</p>
                {service.reviewCount > 0 && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-5 h-5 ${
                            i < Math.floor(service.rating) ? "text-yellow-400 fill-current" : "text-white/30"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="font-medium">{service.rating.toFixed(1)}</span>
                    <span className="text-white/80">({service.reviewCount} reviews)</span>
                  </div>
                )}
              </div>
              
              {service.featured && (
                <Badge className="bg-accent text-accent-foreground px-4 py-2 text-lg">
                  Featured
                </Badge>
              )}
            </div>

            {/* Click to view full size button - more visible with animation */}
            <div className="mt-6 animate-bounce">
              <Button
                onClick={() => {
                  if (service.images && service.images.length > 0) {
                    setModalImageIndex(selectedImage)
                    setShowImageModal(true)
                  }
                }}
                className="bg-white/20 backdrop-blur-md text-white border-2 border-white/40 hover:bg-white/30 hover:border-white/60 transition-all duration-300 shadow-lg hover:shadow-xl px-6 py-3 text-base font-semibold"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
                Click to View Full Size Images
              </Button>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-8">
        {/* Image Thumbnails */}
        {service.images && service.images.length > 1 && (
          <div className="mb-8 animate-scale-in">
            <h3 className="text-lg font-semibold mb-3">Gallery</h3>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {service.images.map((img, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(index)}
                  className={`shrink-0 w-24 h-24 rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                    selectedImage === index ? "border-accent ring-2 ring-accent/50" : "border-gray-200"
                  }`}
                >
                  <img src={img} alt={`${service.title} ${index + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Full Image Modal */}
        <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
          <DialogContent className="max-w-5xl w-full p-0 bg-black/95">
            <VisuallyHidden>
              <DialogTitle>Service Image Gallery</DialogTitle>
            </VisuallyHidden>
            <div className="relative">
              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
                onClick={() => setShowImageModal(false)}
              >
                <X className="h-6 w-6" />
              </Button>

              {/* Image */}
              {service.images && service.images.length > 0 && (
                <div className="relative">
                  <img
                    src={service.images[modalImageIndex]}
                    alt={`${service.title} - Image ${modalImageIndex + 1}`}
                    className="w-full h-auto max-h-[80vh] object-contain"
                  />

                  {/* Navigation arrows */}
                  {service.images.length > 1 && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                        onClick={() => setModalImageIndex((prev) => (prev === 0 ? service.images!.length - 1 : prev - 1))}
                      >
                        <ChevronLeft className="h-8 w-8" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                        onClick={() => setModalImageIndex((prev) => (prev === service.images!.length - 1 ? 0 : prev + 1))}
                      >
                        <ChevronRight className="h-8 w-8" />
                      </Button>
                    </>
                  )}

                  {/* Image counter */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                    {modalImageIndex + 1} / {service.images.length}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6 animate-fade-in">
            {/* Title & Provider */}
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">{service.title}</h1>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={service.providerImage} />
                    <AvatarFallback>{service.providerName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{service.providerName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{service.category}</p>
                  </div>
                </div>

                {service.reviewCount > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">{service.rating.toFixed(1)}</span>
                    <span className="text-muted-foreground">({service.reviewCount} reviews)</span>
                  </div>
                )}

                <Badge variant="outline" className="capitalize">
                  {service.locationType.replace("-", " ")}
                </Badge>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="description" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="description" className="flex-1">Description</TabsTrigger>
                <TabsTrigger value="availability" className="flex-1">Availability</TabsTrigger>
                <TabsTrigger value="reviews" className="flex-1">Reviews</TabsTrigger>
              </TabsList>

              <TabsContent value="description" className="space-y-4 mt-6">
                <div>
                  <h3 className="text-xl font-semibold mb-2">About This Service</h3>
                  <p className="text-muted-foreground whitespace-pre-line">{service.description}</p>
                </div>

                {service.tags && service.tags.length > 0 && (
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {service.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {service.location && (
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Location</h3>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-5 w-5" />
                      <span>{service.location}</span>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="availability" className="mt-6">
                <h3 className="text-xl font-semibold mb-4">Available Days</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(service.availability || {}).map(([day, schedule]: [string, any]) => (
                    <Card key={day} className={!schedule.available ? "opacity-50" : ""}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm capitalize flex items-center gap-2">
                          {schedule.available && <CheckCircle className="h-4 w-4 text-green-500" />}
                          {day}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {schedule.available ? (
                          <p className="text-sm text-muted-foreground">
                            {schedule.start} - {schedule.end}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">Unavailable</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="reviews" className="mt-6">
                <div className="text-center py-8 text-muted-foreground">
                  <Star className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No reviews yet. Be the first to book and review!</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Booking Sidebar */}
          <div className="animate-fade-in-delay">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-2xl text-accent">{getPriceDisplay()}</CardTitle>
                <CardDescription>
                  {service.duration && `${service.duration} minutes session`}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{service.duration || "Variable"} minutes</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="capitalize">{service.locationType.replace("-", " ")}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Available: {getAvailabilityDays().join(", ")}</span>
                  </div>
                </div>

                <div className="pt-4 border-t space-y-2">
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => {
                      if (!user) {
                        router.push("/login")
                      } else {
                        setShowBookingModal(true)
                      }
                    }}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Book Appointment
                  </Button>

                  <Button 
                    variant="outline" 
                    className="w-full" 
                    size="lg"
                    onClick={handleMessageProvider}
                    disabled={messagingProvider}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    {messagingProvider ? "Opening chat..." : "Message Provider"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Booking Modal */}
      {showBookingModal && service && (
        <BookingModal
          service={service}
          isOpen={showBookingModal}
          onClose={() => setShowBookingModal(false)}
        />
      )}

      <Footer />
    </div>
  )
}
