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
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <nav className="text-sm text-muted-foreground mb-4">
              <Link href="/" className="hover:text-primary">
                Home
              </Link>
              <span className="mx-2">/</span>
              <span>Categories</span>
            </nav>
            <h1 className="text-3xl font-bold mb-4">Shop by Category</h1>
            <p className="text-muted-foreground">
              Discover thousands of products across our diverse categories
            </p>
          </div>

          {/* Categories Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {categories.map((category) => {
              const IconComponent = category.icon
              return (
                <Link key={category.slug} href={`/category/${category.slug}`}>
                  <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer">
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-4 mb-4">
                        <div className={`${category.color} p-3 rounded-lg text-white`}>
                          <IconComponent className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                            {category.name}
                          </h3>
                          <Badge variant="secondary" className="text-xs">
                            {category.count}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-muted-foreground text-sm">
                        {category.description}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>

          {/* Popular Categories */}
          <div className="mt-16">
            <h2 className="text-2xl font-bold mb-6">Popular Categories</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {categories.slice(0, 4).map((category) => (
                <Link 
                  key={`popular-${category.slug}`} 
                  href={`/category/${category.slug}`}
                  className="group"
                >
                  <div className="bg-muted/50 rounded-lg p-4 text-center hover:bg-muted transition-colors">
                    <div className={`${category.color} w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3 text-white`}>
                      <category.icon className="w-6 h-6" />
                    </div>
                    <h3 className="font-medium group-hover:text-primary transition-colors">
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