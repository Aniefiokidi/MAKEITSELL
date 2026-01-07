"use client"

import Footer from "@/components/Footer"
import Header from "@/components/Header"

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
        <Header/>
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-full text-sm font-medium mb-6">
              <div className="w-4 h-4">
                <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
              </div>
              Empowering Businesses Worldwide
            </div>
            <h1 className="text-5xl md:text-7xl font-black bg-gradient-to-r from-foreground via-accent to-foreground bg-clip-text text-transparent mb-6 leading-tight">
              About Make It Sell
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              We're not just a marketplace – we're your business growth partner 
              <span className="inline-block ml-2 w-8 h-8 align-middle">
                <svg className="w-full h-full text-accent animate-bounce" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L15.09 8.26L22 9L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9L8.91 8.26L12 2Z"/>
                </svg>
              </span>
            </p>
          </div>

          {/* Mission Section */}
          <div className="grid lg:grid-cols-2 gap-16 items-center mb-24">
            <div className="order-2 lg:order-1">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-accent rounded-2xl flex items-center justify-center">
                    <svg className="w-8 h-8 text-accent-foreground animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10"/>
                      <circle cx="12" cy="12" r="6"/>
                      <circle cx="12" cy="12" r="2"/>
                    </svg>
                  </div>
                  <h2 className="text-3xl font-bold">Our Mission</h2>
                </div>
                <div className="space-y-4 text-lg text-muted-foreground leading-relaxed">
                  <p>
                    Make It Sell exists to help brand and business owners reach out to a larger audience by providing 
                    a powerful marketplace platform that amplifies their reach. We empower businesses of all sizes to 
                    showcase their products and services to thousands of potential customers they couldn't reach otherwise.
                  </p>
                  <p>
                    Whether you're a small local business or an established brand, our platform breaks down barriers 
                    and connects you directly with customers who are looking for exactly what you offer. We believe 
                    every business deserves the opportunity to grow and thrive.
                  </p>
                </div>
                <div className="flex gap-4">
                  <div className="bg-accent/10 text-accent px-4 py-2 rounded-full text-sm font-medium">
                    #BusinessGrowth
                  </div>
                  <div className="bg-accent/10 text-accent px-4 py-2 rounded-full text-sm font-medium">
                    #ReachMore
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-accent/20 to-accent/10 rounded-3xl blur-xl"></div>
                <div className="relative bg-card border border-border/50 rounded-3xl p-8 shadow-2xl">
                  <img src="/heroimg8.jpg" alt="Make It Sell team" className="w-full h-80 object-cover rounded-2xl" />
                  <div className="absolute -bottom-6 -right-6 bg-accent text-accent-foreground w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-8 h-8 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2L15.09 8.26L22 9L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9L8.91 8.26L12 2Z"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="mb-24">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4">Why Businesses Choose Us</h2>
              <p className="text-xl text-muted-foreground">Three game-changing benefits that set us apart</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="group">
                <div className="relative bg-gradient-to-br from-card to-accent/5 border border-border/50 rounded-3xl p-8 text-center hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                    <div className="w-16 h-16 bg-gradient-to-br from-accent to-accent/80 rounded-2xl flex items-center justify-center shadow-xl">
                      <svg className="w-8 h-8 text-accent-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="pt-8">
                    <h3 className="text-2xl font-bold mb-4">Expand Your Reach</h3>
                    <p className="text-muted-foreground text-lg leading-relaxed">Connect with thousands of customers beyond your local market</p>
                    <div className="mt-6 inline-flex items-center gap-2 text-accent font-medium group-hover:gap-3 transition-all">
                      <span>Learn More</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <div className="group">
                <div className="relative bg-gradient-to-br from-card to-accent/5 border border-border/50 rounded-3xl p-8 text-center hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                    <div className="w-16 h-16 bg-gradient-to-br from-accent to-accent/80 rounded-2xl flex items-center justify-center shadow-xl">
                      <svg className="w-8 h-8 text-accent-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="pt-8">
                    <h3 className="text-2xl font-bold mb-4">Boost Sales</h3>
                    <p className="text-muted-foreground text-lg leading-relaxed">Increase revenue with access to a broader customer base</p>
                    <div className="mt-6 inline-flex items-center gap-2 text-accent font-medium group-hover:gap-3 transition-all">
                      <span>Learn More</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <div className="group">
                <div className="relative bg-gradient-to-br from-card to-accent/5 border border-border/50 rounded-3xl p-8 text-center hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                    <div className="w-16 h-16 bg-gradient-to-br from-accent to-accent/80 rounded-2xl flex items-center justify-center shadow-xl">
                      <svg className="w-8 h-8 text-accent-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="pt-8">
                    <h3 className="text-2xl font-bold mb-4">Build Your Brand</h3>
                    <p className="text-muted-foreground text-lg leading-relaxed">Establish your business presence and build customer loyalty</p>
                    <div className="mt-6 inline-flex items-center gap-2 text-accent font-medium group-hover:gap-3 transition-all">
                      <span>Learn More</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-accent/20 via-accent/10 to-transparent rounded-3xl"></div>
            <div className="relative bg-gradient-to-br from-card to-accent/5 border border-border/50 rounded-3xl p-12 text-center shadow-2xl">
              <div className="max-w-3xl mx-auto">
                <div className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-4 py-2 rounded-full text-sm font-bold mb-6">
                  <svg className="w-4 h-4 animate-spin" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L15.09 8.26L22 9L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9L8.91 8.26L12 2Z"/>
                  </svg>
                  Ready to Scale?
                </div>
                <h2 className="text-4xl md:text-5xl font-black mb-6 bg-gradient-to-r from-foreground to-accent bg-clip-text text-transparent">
                  Grow Your Business with Us
                </h2>
                <p className="text-xl text-muted-foreground mb-10 leading-relaxed">
                  Join thousands of businesses that have expanded their reach and increased their sales through Make It Sell.
                  From small startups to established brands, we help businesses connect with their ideal customers.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <a
                    href="/signup"
                    className="group relative bg-accent hover:bg-accent/80 text-accent-foreground px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl"
                  >
                    <span className="relative z-10">Start Selling Today</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-accent to-accent/80 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </a>
                  <a 
                    href="/stores" 
                    className="group border-2 border-accent text-accent hover:bg-accent hover:text-accent-foreground px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 hover:scale-105"
                  >
                    <span>Explore Marketplace</span>
                  </a>
                </div>
                
                {/* Stats */}
                <div className="grid grid-cols-3 gap-8 mt-12 pt-8 border-t border-border/50">
                  <div>
                    <div className="text-3xl font-black text-accent">10K+</div>
                    <div className="text-sm text-muted-foreground font-medium">Active Sellers</div>
                  </div>
                  <div>
                    <div className="text-3xl font-black text-accent">100K+</div>
                    <div className="text-sm text-muted-foreground font-medium">Happy Customers</div>
                  </div>
                  <div>
                    <div className="text-3xl font-black text-accent">24/7</div>
                    <div className="text-sm text-muted-foreground font-medium">Support</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer/>
    </div>
  )
}
