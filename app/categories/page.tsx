import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { 
  Smartphone, 
  Shirt, 
  Home, 
  Watch, 
  Dumbbell,
  Headphones,
  Camera,
  Book,
  Gamepad2,
  Car
} from "lucide-react"

const categories = [
  {
    slug: "electronics",
    name: "Electronics",
    description: "Latest gadgets, smartphones, computers and more",
    icon: Smartphone,
    color: "bg-blue-500",
    count: "2,500+ items"
  },
  {
    slug: "fashion",
    name: "Fashion",
    description: "Clothing, shoes, bags and accessories",
    icon: Shirt,
    color: "bg-pink-500",
    count: "1,800+ items"
  },
  {
    slug: "home",
    name: "Home & Garden",
    description: "Furniture, decor, kitchen and garden items",
    icon: Home,
    color: "bg-green-500",
    count: "1,200+ items"
  },
  {
    slug: "accessories",
    name: "Accessories",
    description: "Watches, jewelry, bags and more",
    icon: Watch,
    color: "bg-purple-500",
    count: "900+ items"
  },
  {
    slug: "sports",
    name: "Sports & Fitness",
    description: "Exercise equipment, sportswear and outdoor gear",
    icon: Dumbbell,
    color: "bg-orange-500",
    count: "750+ items"
  },
  {
    slug: "audio",
    name: "Audio & Music",
    description: "Headphones, speakers, instruments",
    icon: Headphones,
    color: "bg-red-500",
    count: "600+ items"
  },
  {
    slug: "photography",
    name: "Photography",
    description: "Cameras, lenses, lighting equipment",
    icon: Camera,
    color: "bg-indigo-500",
    count: "400+ items"
  },
  {
    slug: "books",
    name: "Books & Media",
    description: "Books, magazines, digital content",
    icon: Book,
    color: "bg-amber-500",
    count: "1,500+ items"
  },
  {
    slug: "gaming",
    name: "Gaming",
    description: "Video games, consoles, accessories",
    icon: Gamepad2,
    color: "bg-teal-500",
    count: "800+ items"
  },
  {
    slug: "automotive",
    name: "Automotive",
    description: "Car accessories, tools, parts",
    icon: Car,
    color: "bg-slate-500",
    count: "650+ items"
  }
]

export default function CategoriesPage() {
  return (
    <>
      <Header />
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
          {/* Header */}
          <div className="mb-4 sm:mb-8 animate-fade-in">
            <nav className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-4">
              <Link href="/" className="hover:text-primary">
                Home
              </Link>
              <span className="mx-2">/</span>
              <span>Categories</span>
            </nav>
            <h1 className="text-xl sm:text-3xl font-bold mb-2 sm:mb-4" style={{ textShadow: '1px 1px 0 hsl(var(--accent)), -1px -1px 0 hsl(var(--accent)), 1px -1px 0 hsl(var(--accent)), -1px 1px 0 hsl(var(--accent))' }}>Shop by Category</h1>
            <p className="text-muted-foreground text-xs sm:text-base">
              Discover thousands of products across our diverse categories
            </p>
          </div>

          {/* Categories Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
            {categories.map((category, index) => {
              const IconComponent = category.icon
              return (
                <Link key={category.slug} href={`/category/${category.slug}`}>
                  <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer animate-scale-in hover-lift" style={{ animationDelay: `${index * 0.05}s` }}>
                    <CardContent className="p-3 sm:p-6">
                      <div className="flex items-center space-x-2 sm:space-x-4 mb-2 sm:mb-4">
                        <div className={`${category.color} p-2 sm:p-3 rounded-lg text-white`}>
                          <IconComponent className="w-4 h-4 sm:w-6 sm:h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-xs sm:text-lg group-hover:text-primary transition-colors truncate">
                            {category.name}
                          </h3>
                          <Badge variant="secondary" className="text-[7px] sm:text-xs whitespace-nowrap">
                            {category.count}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-muted-foreground text-[10px] sm:text-sm line-clamp-2 sm:line-clamp-none">
                        {category.description}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>

          {/* Popular Categories */}
          <div className="mt-8 sm:mt-16 animate-fade-in" style={{ animationDelay: '0.5s' }}>
            <h2 className="text-lg sm:text-2xl font-bold mb-3 sm:mb-6" style={{ textShadow: '1px 1px 0 hsl(var(--accent)), -1px -1px 0 hsl(var(--accent)), 1px -1px 0 hsl(var(--accent)), -1px 1px 0 hsl(var(--accent))' }}>Popular Categories</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
              {categories.slice(0, 4).map((category, index) => (
                <Link 
                  key={`popular-${category.slug}`} 
                  href={`/category/${category.slug}`}
                  className="group animate-scale-in hover-lift"
                  style={{ animationDelay: `${0.6 + index * 0.1}s` }}
                >
                  <div className="bg-muted/50 rounded-lg p-2 sm:p-4 text-center hover:bg-muted transition-colors">
                    <div className={`${category.color} w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-3 text-white`}>
                      <category.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <h3 className="font-medium text-xs sm:text-base group-hover:text-primary transition-colors truncate">
                      {category.name}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}