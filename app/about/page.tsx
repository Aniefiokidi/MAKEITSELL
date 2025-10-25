import Footer from "@/components/Footer"
import Header from "@/components/Header"

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
        <Header/>
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-center mb-8">About BRANDA</h1>

          <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
            <div>
              <h2 className="text-2xl font-semibold mb-4">Our Mission</h2>
              <p className="text-muted-foreground mb-6">
                BRANDA is revolutionizing e-commerce by creating a unified marketplace that connects buyers and sellers
                with AI-powered customer service. We believe in making online shopping seamless, secure, and satisfying
                for everyone.
              </p>
              <p className="text-muted-foreground">
                Our platform combines the best of traditional marketplaces with cutting-edge AI technology to provide
                instant support, smart recommendations, and efficient problem resolution.
              </p>
            </div>
            <div className="bg-muted rounded-lg p-8">
              <img src="/heroimg8.jpg" alt="BRANDA team" className="w-full h-64 object-cover rounded-lg" />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="text-center">
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Fast & Reliable</h3>
              <p className="text-muted-foreground">Lightning-fast performance with 99.9% uptime guarantee</p>
            </div>

            <div className="text-center">
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Secure</h3>
              <p className="text-muted-foreground">Bank-level security with encrypted transactions</p>
            </div>

            <div className="text-center">
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-2-2V10a2 2 0 012-2h2m2-4h6a2 2 0 012 2v6a2 2 0 01-2 2h-6l-4 4V8a2 2 0 012-2z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">AI Support</h3>
              <p className="text-muted-foreground">24/7 intelligent customer service powered by AI</p>
            </div>
          </div>

          <div className="bg-muted rounded-lg p-8 text-center">
            <h2 className="text-2xl font-semibold mb-4">Join Our Growing Community</h2>
            <p className="text-muted-foreground mb-6">
              Over 10,000+ sellers and 100,000+ satisfied customers trust BRANDA for their e-commerce needs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/signup"
                className="bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors"
              >
                Start Selling
              </a>
              <a href="/shop" className="border border-border px-6 py-3 rounded-lg hover:bg-muted transition-colors">
                Start Shopping
              </a>
            </div>
          </div>
        </div>
      </div>
      <Footer/>
    </div>
  )
}
