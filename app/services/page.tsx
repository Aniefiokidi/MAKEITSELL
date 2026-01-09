"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getServices, Service } from "@/lib/database-client"
import { Search, MapPin, Clock, Banknote, Verified, RefreshCw, Camera, Briefcase, Wrench, Palette, Dumbbell, GraduationCap, Scissors, Sparkles, Laptop, Settings } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import Image from "next/image"

// Function to get icon component based on category
const getCategoryIcon = (category: string) => {
  switch(category) {
    case "photography":
      return <Camera className="h-8 w-8 text-white" />
    case "consulting":
      return <Briefcase className="h-8 w-8 text-white" />
    case "repairs":
      return <Wrench className="h-8 w-8 text-white" />
    case "design":
      return <Palette className="h-8 w-8 text-white" />
    case "fitness":
      return <Dumbbell className="h-8 w-8 text-white" />
    case "education":
      return <GraduationCap className="h-8 w-8 text-white" />
    case "beauty":
      return <Scissors className="h-8 w-8 text-white" />
    case "cleaning":
      return <Sparkles className="h-8 w-8 text-white" />
    case "tech":
      return <Laptop className="h-8 w-8 text-white" />
    default:
      return <Settings className="h-8 w-8 text-white" />
  }
}

const SERVICE_CATEGORIES = [
  { value: "all", label: "All Services" },
  { value: "photography", label: "Photography" },
  { value: "consulting", label: "Consulting" },
  { value: "repairs", label: "Repairs & Maintenance" },
  { value: "design", label: "Design & Creative" },
  { value: "fitness", label: "Fitness & Wellness" },
  { value: "education", label: "Education & Tutoring" },
  { value: "beauty", label: "Beauty" },
  { value: "cleaning", label: "Cleaning Services" },
  { value: "tech", label: "Tech Support" },
  { value: "other", label: "Other Services" },
]

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [filteredServices, setFilteredServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
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
      
      // Check if services are cached in sessionStorage
      const cachedServices = sessionStorage.getItem('marketplace-services')
      const cacheTimestamp = sessionStorage.getItem('marketplace-services-timestamp')
      const now = Date.now()
      
      // Use cache if it's less than 5 minutes old
      if (cachedServices && cacheTimestamp) {
        const parsedServices = JSON.parse(cachedServices)
        const cacheIsFresh = (now - parseInt(cacheTimestamp)) < 300000
        if (cacheIsFresh && Array.isArray(parsedServices) && parsedServices.length > 0) {
          setServices(parsedServices)
          console.log(`Loaded ${parsedServices.length} services from cache`)
          setLoading(false)
          return
        }
      }
      
      // Fetch real services from Firestore only
      const firestoreServices = await getServices()
      
      // Cache the results
      if (firestoreServices.length > 0) {
        sessionStorage.setItem('marketplace-services', JSON.stringify(firestoreServices))
        sessionStorage.setItem('marketplace-services-timestamp', now.toString())
      }
      
      setServices(firestoreServices)
      console.log(`Loaded ${firestoreServices.length} real services from registered providers`)
    } catch (error) {
      console.error("Error loading services:", error)
      setServices([])
    } finally {
      setLoading(false)
    }
  }

  // Refresh function to reload services
  const refreshServices = async () => {
    setRefreshing(true)
    try {
      // Clear cache before fetching
      sessionStorage.removeItem('marketplace-services')
      sessionStorage.removeItem('marketplace-services-timestamp')
      
      // Fetch fresh data
      const firestoreServices = await getServices()
      
      // Update cache with fresh data if we actually have services
      if (firestoreServices.length > 0) {
        sessionStorage.setItem('marketplace-services', JSON.stringify(firestoreServices))
        sessionStorage.setItem('marketplace-services-timestamp', Date.now().toString())
      }
      
      setServices(firestoreServices)
      console.log(`Refreshed: ${firestoreServices.length} real services from registered providers`)
    } catch (error) {
      console.error("Error refreshing services:", error)
    }
    setRefreshing(false)
  }

  const filterServices = () => {
    let filtered = services

    if (searchQuery) {
      filtered = filtered.filter(
        (service) =>
          (service.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          service.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          service.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (selectedCategory !== "all") {
      filtered = filtered.filter((service) => service.category.includes(selectedCategory))
    }

    if (selectedLocation !== "all") {
      filtered = filtered.filter((service) => service.location.toLowerCase().includes(selectedLocation.toLowerCase()))
    }

    setFilteredServices(filtered)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        {/* Header with Title and Filters */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <h1 className="text-5xl md:text-7xl font-black tracking-wider uppercase" style={{ fontFamily: '"Bebas Neue", "Impact", sans-serif' }}>
            <span className="drop-shadow-[0_2px_2px_oklch(0.35_0.15_15/0.5)]" style={{WebkitTextFillColor: 'white', WebkitTextStroke: '1px oklch(0.35 0.15 15)', color: 'white'}}>ALL SERVICES</span>
          </h1>
          
          {/* Filter Section */}
          <div className="flex items-center gap-3 p-4 bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50">
            <span className="text-sm font-black uppercase tracking-wider text-muted-foreground" style={{ fontFamily: '"Bebas Neue", "Impact", sans-serif' }}>Category:</span>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[180px] border-2 border-accent/20 hover:border-accent/40 transition-colors">
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
            {selectedCategory !== "all" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCategory("all")}
                className="text-xs hover:text-accent hover:bg-accent/10 transition-all"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Search and Sort */}
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <div className="flex-1 relative group">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5 group-focus-within:text-primary transition-colors" />
            <Input
              type="search"
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 border-2 focus:border-primary transition-colors"
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="home-service">Home Service</SelectItem>
                <SelectItem value="store">Store/Office</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={refreshServices}
              disabled={refreshing}
              className="hover:scale-110 hover:bg-accent/10 transition-all"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading services..." : `Showing ${filteredServices.length} service${filteredServices.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Services Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
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
          <div className="text-center py-24" style={{ fontFamily: '"Bebas Neue", "Impact", sans-serif' }}>
            {services.length === 0 ? (
              <div className="space-y-4">
                <div className="inline-flex p-8 bg-linear-to-br from-accent/20 to-orange-500/20 rounded-full mb-8 border-4 border-accent/20 shadow-2xl shadow-accent/20 animate-pulse">
                  <svg className="h-24 w-24 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="text-5xl font-black mb-4 tracking-wider uppercase">NO SERVICES YET BESTIE</h3>
                <p className="text-muted-foreground text-xl font-bold mb-8 max-w-md mx-auto uppercase tracking-wide">
                  SERVICES WILL DROP HERE WHEN PROVIDERS JOIN THE VIBE
                </p>
                <Button onClick={refreshServices} disabled={refreshing} size="lg" className="bg-linear-to-r from-accent to-orange-600 hover:from-orange-600 hover:to-accent text-white font-black text-xl px-8 py-6 rounded-full shadow-2xl shadow-accent/30 hover:scale-105 transition-all uppercase tracking-wider">
                  <RefreshCw className="h-5 w-5 mr-2" />
                  CHECK FOR NEW SERVICES
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="inline-flex p-8 bg-linear-to-br from-accent/20 to-orange-500/20 rounded-full mb-8 border-4 border-accent/20 shadow-2xl shadow-accent/20 animate-pulse">
                  <svg className="h-24 w-24 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-5xl font-black mb-4 tracking-wider uppercase">NO SERVICES FOUND BESTIE</h3>
                <p className="text-muted-foreground text-xl font-bold mb-8 max-w-md mx-auto uppercase tracking-wide">
                  TRY DIFFERENT FILTERS OR SEARCH TERMS TO FIND UR VIBE
                </p>
                <Button onClick={() => {
                  setSearchQuery("")
                  setSelectedCategory("all")
                  setSelectedLocation("all")
                }} size="lg" className="bg-linear-to-r from-accent to-orange-600 hover:from-orange-600 hover:to-accent text-white font-black text-xl px-8 py-6 rounded-full shadow-2xl shadow-accent/30 hover:scale-105 transition-all uppercase tracking-wider">
                  CLEAR FILTERS FR
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 animate-in fade-in duration-500">
            {filteredServices.map((service, index) => {
              const serviceName = service.title || 'Service'
              
              return (
                <Card 
                  key={service.id} 
                  className="h-full hover:shadow-2xl hover:shadow-accent/40 hover:scale-[1.02] transition-all duration-300 group overflow-hidden border-none rounded-[2.5rem] relative" 
                  style={{ fontFamily: '"Montserrat", "Inter", system-ui, sans-serif' }}
                >
                  {/* Full Image Background */}
                  <div className="aspect-[9/16] relative overflow-hidden rounded-[2.5rem]">
                    {service.images && service.images.length > 0 ? (
                      <Image
                        src={service.images[0]}
                        alt={serviceName}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full bg-linear-to-br from-accent/90 via-orange-500/90 to-red-600/90">
                        <svg className="h-20 w-20 text-white drop-shadow-lg animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                    )}
                    
                    {/* Dark overlay gradient at bottom for text readability */}
                    <div className="absolute inset-0 bg-linear-to-b from-black/20 via-transparent via-50% to-black/90" />
                    
                    {/* Provider Icon in Center Top */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
                      <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md border-4 border-white overflow-hidden shadow-2xl ring-4 ring-white/30 group-hover:ring-white/50 transition-all group-hover:scale-110">
                        <div className="w-full h-full flex items-center justify-center">
                          {getCategoryIcon(service.category)}
                        </div>
                      </div>
                    </div>

                    {/* Content Overlay at Bottom */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
                      <div className="backdrop-blur-md bg-black/20 rounded-2xl p-4 border border-white/10">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-xl font-bold tracking-tight mb-1 text-white drop-shadow-lg truncate">
                              {serviceName}
                            </h3>
                            {service.providerName && (
                              <div className="flex items-center gap-1 text-xs font-medium text-white/90 tracking-wide mb-2">
                                <Verified className="h-3 w-3 shrink-0" />
                                <span className="truncate">{service.providerName}</span>
                              </div>
                            )}
                            
                            <Badge variant="outline" className="w-fit text-[10px] font-semibold py-0.5 px-2 h-5 tracking-wide border-2 border-white/40 bg-white/10 text-white backdrop-blur-sm">
                              {SERVICE_CATEGORIES.find(c => c.value === service.category)?.label || service.category}
                            </Badge>
                          </div>

                          {/* Arrow Button */}
                          <Link href={`/service/${service.id}`}>
                            <div className="shrink-0 w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-xl hover:scale-110 hover:bg-accent hover:text-white transition-all cursor-pointer group/arrow">
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent group-hover/arrow:text-white">
                                <path d="M5 12h14"/>
                                <path d="m12 5 7 7-7 7"/>
                              </svg>
                            </div>
                          </Link>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-3 text-[11px] font-medium text-white/80 tracking-wide">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{service.duration}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Banknote className="h-3 w-3" />
                            <span>{formatCurrency(service.price)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
