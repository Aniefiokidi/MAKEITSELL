import Header from "@/components/Header"
import HeroSection from "@/components/HeroSection"
import CategorySection from "@/components/CategorySection"
import FeaturedProducts from "@/components/FeaturedProducts"
import FeaturedServices from "@/components/FeaturedServices"
import Footer from "@/components/Footer"
import TestimonialsSection from "@/components/TestimonialsSection"

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <HeroSection />
        <CategorySection />
        <FeaturedProducts />
        <FeaturedServices />
        <TestimonialsSection />
      </main>
      <Footer />
    </div>
  )
}
