import { Card, CardContent } from "@/components/ui/card"
import { Smartphone, Shirt, Home, Car, Wrench, Gamepad2, Book, Heart } from "lucide-react"
import Link from "next/link"

const categories = [
  { name: "Electronics", icon: Smartphone, href: "/category/electronics" },
  { name: "Fashion", icon: Shirt, href: "/category/fashion" },
  { name: "Home & Garden", icon: Home, href: "/category/home" },
  { name: "Automotive", icon: Car, href: "/category/automotive" },
  { name: "Tools", icon: Wrench, href: "/category/tools" },
  { name: "Gaming", icon: Gamepad2, href: "/category/gaming" },
  { name: "Books", icon: Book, href: "/category/books" },
  { name: "Health", icon: Heart, href: "/category/health" },
]

export default function CategorySection() {
  return (
    <section className="py-8 sm:py-12 bg-muted/30">
      <div className="container mx-auto px-2 sm:px-4">
        <div className="text-center mb-6 sm:mb-8 animate-fade-in">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-balance" style={{ textShadow: '1px 1px 0 hsl(var(--accent)), -1px -1px 0 hsl(var(--accent)), 1px -1px 0 hsl(var(--accent)), -1px 1px 0 hsl(var(--accent))' }}>Shop by Category</h2>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-xs sm:text-sm">Find exactly what you're looking for</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8">
          {categories.map((category, index) => (
            <Link key={category.name} href={category.href}>
              <Card className="group hover:shadow-md transition-all duration-200 hover:scale-105 animate-scale-in hover-lift" style={{ animationDelay: `${index * 0.1}s` }}>
                <CardContent className="flex flex-col items-center justify-center p-2 sm:p-4 md:p-6 text-center">
                  <category.icon className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 mb-1 sm:mb-2 md:mb-3 text-accent group-hover:text-accent/80 transition-colors animate-float" style={{ animationDelay: `${index * 0.15}s` }} />
                  <span className="text-[10px] sm:text-xs md:text-sm font-medium text-pretty">{category.name}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
