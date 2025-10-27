"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getServices, Service } from "@/lib/firestore"
import { Search, MapPin, Clock, DollarSign, Star } from "lucide-react"

const SERVICE_CATEGORIES = [
  { value: "all", label: "All Services" },
  { value: "photography", label: "Photography" },
  { value: "consulting", label: "Consulting" },
  { value: "repairs", label: "Repairs & Maintenance" },
  { value: "design", label: "Design & Creative" },
  { value: "fitness", label: "Fitness & Wellness" },
  { value: "education", label: "Education & Tutoring" },
  { value: "beauty", label: "Beauty & Grooming" },
  { value: "cleaning", label: "Cleaning Services" },
  { value: "tech", label: "Tech Support" },
  { value: "other", label: "Other Services" },
]

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [filteredServices, setFilteredServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedLocation, setSelectedLocation] = useState("all")

  useEffect(() => {
    fetchServices()
  }, [])

  useEffect(() => {
    filterServices()
  }, [searchQuery, selectedCategory, selectedLocation, services])

  const fetchServices = async () => {
    try {
      setLoading(true)
      const data = await getServices()
      setServices(data)
      setFilteredServices(data)
    } catch (error) {
      console.error("Error fetching services:", error)
    } finally {
      setLoading(false)
    }
  }

  const filterServices = () => {
    let filtered = services

    if (searchQuery) {
      filtered = filtered.filter(
        (service) =>
          service.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          service.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          service.providerName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (selectedCategory !== "all") {
      filtered = filtered.filter((service) => service.category === selectedCategory)
    }

    if (selectedLocation !== "all") {
      filtered = filtered.filter((service) => service.locationType === selectedLocation)
    }

    setFilteredServices(filtered)
  }

  const getPriceDisplay = (service: Service) => {
    const priceTypeMap = {
      fixed: "",
      hourly: "/hr",
      "per-session": "/session",
      custom: "",
    }
    return `$${service.price}${priceTypeMap[service.pricingType]}`
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4" style={{
            textShadow: '2px 2px 0 #8b2e0b, -2px -2px 0 #8b2e0b, 2px -2px 0 #8b2e0b, -2px 2px 0 #8b2e0b'
          }}>
            Find Expert Services
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Book professional services from verified providers. From photography to consulting, find the perfect expert for your needs.
          </p>
        </div>

        {/* Search & Filters */}
        <div className="bg-card rounded-lg shadow-md p-6 mb-8 animate-scale-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search services..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Location Type Filter */}
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger>
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="in-person">In-Person</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Results Count */}
          <div className="mt-4 text-sm text-muted-foreground">
            Showing {filteredServices.length} service{filteredServices.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Services Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-48 bg-muted rounded-t-lg" />
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="h-20 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="text-center py-16 animate-fade-in">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-2xl font-semibold mb-2">No services found</h3>
            <p className="text-muted-foreground mb-6">Try adjusting your search or filters</p>
            <Button onClick={() => {
              setSearchQuery("")
              setSelectedCategory("all")
              setSelectedLocation("all")
            }}>
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map((service, index) => (
              <Card 
                key={service.id} 
                className="group hover-lift animate-scale-in overflow-hidden hover:shadow-lg transition-all duration-300"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <Link href={`/service/${service.id}`}>
                  {/* Service Provider Banner */}
                  <div className="relative h-32 overflow-hidden bg-gradient-to-r from-[oklch(0.21_0.194_29.234)] to-[oklch(0.32_0.194_29.234)]">
                    {service.providerImage ? (
                      <img
                        src={service.providerImage}
                        alt={service.providerName}
                        className="w-full h-full object-cover opacity-30"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-r from-[oklch(0.21_0.194_29.234)] to-[oklch(0.32_0.194_29.234)]" />
                    )}
                    {service.featured && (
                      <Badge className="absolute top-2 right-2 bg-white text-[oklch(0.21_0.194_29.234)]">
                        Featured
                      </Badge>
                    )}
                  </div>

                  {/* Service Image */}
                  <div className="relative h-48 overflow-hidden bg-muted -mt-16 mx-4 rounded-lg shadow-lg border-4 border-white">
                    {service.images && service.images.length > 0 ? (
                      <img
                        src={service.images[0]}
                        alt={service.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-6xl bg-muted">
                        🛠️
                      </div>
                    )}
                  </div>
                </Link>

                <CardHeader className="pt-6">
                  <CardTitle className="line-clamp-1">
                    <Link href={`/service/${service.id}`} className="hover:text-accent transition-colors">
                      {service.title}
                    </Link>
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    <span>{service.providerName}</span>
                    {service.reviewCount > 0 && (
                      <span className="flex items-center gap-1 ml-2">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs">{service.rating.toFixed(1)} ({service.reviewCount})</span>
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {service.description}
                  </p>

                  <div className="space-y-2 text-sm">
                    {/* Price */}
                    <div className="flex items-center gap-2 text-accent font-semibold">
                      <DollarSign className="h-4 w-4" />
                      <span>{getPriceDisplay(service)}</span>
                    </div>

                    {/* Duration */}
                    {service.duration && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{service.duration} minutes</span>
                      </div>
                    )}

                    {/* Location */}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span className="capitalize">{service.locationType.replace("-", " ")}</span>
                    </div>
                  </div>
                </CardContent>

                <CardFooter>
                  <Link href={`/service/${service.id}`} className="w-full">
                    <Button className="w-full">Book Now</Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
