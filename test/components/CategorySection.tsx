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
    <section className="py-12 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-balance">Shop by Category</h2>
          <p className="text-muted-foreground mt-2">Find exactly what you're looking for</p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8">
          {categories.map((category) => (
            <Link key={category.name} href={category.href}>
              <Card className="group hover:shadow-md transition-all duration-200 hover:scale-105">
                <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                  <category.icon className="h-8 w-8 mb-3 text-accent group-hover:text-accent/80 transition-colors" />
                  <span className="text-sm font-medium text-pretty">{category.name}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
