"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getServices, Service } from "@/lib/firestore"
import { Clock, DollarSign, Star, MapPin } from "lucide-react"

export default function FeaturedServices() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFeaturedServices()
  }, [])

  const fetchFeaturedServices = async () => {
    try {
      const data = await getServices({ featured: true, limitCount: 6 })
      setServices(data)
    } catch (error) {
      console.error("Error fetching services:", error)
    } finally {
      setLoading(false)
    }
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

  if (loading) {
    return (
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="h-10 bg-muted rounded w-64 mx-auto mb-4" />
            <div className="h-6 bg-muted rounded w-96 mx-auto" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-48 bg-muted" />
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (services.length === 0) {
    return null
  }

  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-12 animate-fade-in">
          <h2
            className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4"
            style={{
              textShadow: "2px 2px 0 #8b2e0b, -2px -2px 0 #8b2e0b, 2px -2px 0 #8b2e0b, -2px 2px 0 #8b2e0b",
            }}
          >
            Featured Services
          </h2>
          <p className="text-lg text-muted-foreground">
            Book professional services from verified providers
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {services.map((service, index) => (
            <Card
              key={service.id}
              className="group hover-lift animate-scale-in overflow-hidden"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Service Image */}
              <Link href={`/service/${service.id}`}>
                <div className="relative h-48 overflow-hidden bg-muted">
                  {service.images && service.images.length > 0 ? (
                    <img
                      src={service.images[0]}
                      alt={service.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-6xl">
                      🛠️
                    </div>
                  )}
                  <Badge className="absolute top-2 right-2 bg-accent text-accent-foreground">
                    Featured
                  </Badge>
                </div>
              </Link>

              <CardHeader>
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
                      <span className="text-xs">
                        {service.rating.toFixed(1)} ({service.reviewCount})
                      </span>
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

        {/* View All Button */}
        <div className="text-center animate-fade-in-delay">
          <Link href="/services">
            <Button size="lg" variant="outline" className="hover-lift">
              View All Services
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
