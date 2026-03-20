import Link from "next/link"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Camera,
  Briefcase,
  Wrench,
  Palette,
  Dumbbell,
  GraduationCap,
  Scissors,
  Sparkles,
  Laptop,
  Car,
  Megaphone,
  Shield,
  HeartPulse,
  Truck,
  Home,
  CarTaxiFront,
  Music2,
  Settings,
  ArrowRight,
} from "lucide-react"

const SERVICE_CATEGORIES = [
  { value: "photography", label: "Photography", description: "Photo and video sessions", icon: Camera },
  { value: "consulting", label: "Consulting", description: "Business and professional advice", icon: Briefcase },
  { value: "repairs", label: "Repairs & Maintenance", description: "Fixes, installations and upkeep", icon: Wrench },
  { value: "design", label: "Design & Creative", description: "Branding, graphics and visuals", icon: Palette },
  { value: "fitness", label: "Fitness & Wellness", description: "Training, coaching and wellness", icon: Dumbbell },
  { value: "education", label: "Education & Tutoring", description: "Lessons, classes and mentorship", icon: GraduationCap },
  { value: "beauty", label: "Beauty", description: "Personal care and beauty services", icon: Scissors },
  { value: "cleaning", label: "Cleaning Services", description: "Home and office cleaning", icon: Sparkles },
  { value: "tech", label: "Tech Support", description: "Device setup and troubleshooting", icon: Laptop },
  { value: "rentals", label: "Rentals", description: "Short and long term rentals", icon: Car },
  { value: "marketing", label: "Marketing", description: "Promotion and campaign services", icon: Megaphone },
  { value: "legal", label: "Legal Services", description: "Legal advice and support", icon: Shield },
  { value: "healthcare", label: "Healthcare & Wellness", description: "Health and care solutions", icon: HeartPulse },
  { value: "logistics", label: "Logistics & Delivery", description: "Delivery and transport services", icon: Truck },
  { value: "home-improvement", label: "Home Improvement", description: "Renovation and home projects", icon: Home },
  { value: "automotive", label: "Automotive Services", description: "Vehicle repairs and maintenance", icon: CarTaxiFront },
  { value: "event-planning", label: "Event Planning", description: "Planning and event coordination", icon: Music2 },
  { value: "other", label: "Other Services", description: "Browse all additional services", icon: Settings },
]

export default function ServiceCategoriesPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-6 sm:py-10">
        <div className="mb-6 sm:mb-8">
          <nav className="text-sm text-muted-foreground mb-2">
            <Link href="/" className="hover:text-accent">Home</Link>
            <span className="mx-2">/</span>
            <span>Service Categories</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white">Browse Service Categories</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">Choose a category to see only matching service providers.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {SERVICE_CATEGORIES.map((category) => {
            const Icon = category.icon
            return (
              <Link key={category.value} href={`/services?category=${category.value}`}>
                <Card className="h-full border border-accent/20 hover:border-accent/40 transition-all duration-200 hover:shadow-lg">
                  <CardContent className="p-4 sm:p-5">
                    <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center mb-3">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h2 className="text-sm sm:text-base font-semibold text-neutral-900 dark:text-white">{category.label}</h2>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">{category.description}</p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        <div className="mt-8">
          <Link href="/services">
            <Button variant="outline" className="group border-accent text-accent hover:bg-accent/10">
              View All Services
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}
