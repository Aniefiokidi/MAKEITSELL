import Link from "next/link"
import { Facebook, Twitter, Instagram, Mail, Phone } from "lucide-react"

export default function Footer() {
  return (
    <footer className="bg-muted/50 border-t">
      <div className="container mx-auto px-4 py-10">
        {/* Top Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 text-center sm:text-left">
          {/* Company Info */}
          <div>
            <Link href="/" className="flex justify-center sm:justify-start items-center mb-4">
              <img
                src="/images/logo (2).png"
                alt="Logo"
                className="h-8 w-auto object-contain transition-transform duration-300 hover:scale-105"
              />
            </Link>
            <p className="text-muted-foreground mb-5 text-sm leading-relaxed max-w-xs mx-auto sm:mx-0">
              Your trusted marketplace with AI-powered customer service. Connecting buyers and sellers with confidence.
            </p>
            <div className="flex justify-center sm:justify-start space-x-5">
              <Link href="#" className="text-muted-foreground hover:text-accent transition-colors">
                <Facebook className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-accent transition-colors">
                <Twitter className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-accent transition-colors">
                <Instagram className="h-5 w-5" />
              </Link>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-4 text-lg text-center sm:text-left">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/stores" className="text-muted-foreground hover:text-accent">Stores</Link></li>
              <li><Link href="/categories" className="text-muted-foreground hover:text-accent">Categories</Link></li>
              <li><Link href="/services" className="text-muted-foreground hover:text-accent">Services</Link></li>
              <li><Link href="/products" className="text-muted-foreground hover:text-accent">Products</Link></li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h3 className="font-semibold mb-4 text-lg text-center sm:text-left">Customer Service</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/support" className="text-muted-foreground hover:text-accent">Help Center</Link></li>
              <li><Link href="/contact" className="text-muted-foreground hover:text-accent">Contact Us</Link></li>
              <li><Link href="/returns" className="text-muted-foreground hover:text-accent">Returns & Refunds</Link></li>
              <li><Link href="/shipping" className="text-muted-foreground hover:text-accent">Shipping Info</Link></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="font-semibold mb-4 text-lg text-center sm:text-left">Contact Info</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex justify-center sm:justify-start items-center space-x-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">noreply@makeitsell.org</span>
              </li>
              <li className="flex justify-center sm:justify-start items-center space-x-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">+234 9077674884</span>
              </li>
              <li className="flex justify-center sm:justify-start items-center space-x-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">+234 7031984441</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t mt-10 pt-6 flex flex-col md:flex-row justify-between items-center text-center md:text-left gap-3">
          <p className="text-muted-foreground text-sm">
            © 2026 Make It Sell Marketplace. All rights reserved.
          </p>
          <div className="flex flex-wrap justify-center md:justify-end gap-x-6 gap-y-2 text-sm">
            <Link href="/privacy" className="text-muted-foreground hover:text-accent transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-muted-foreground hover:text-accent transition-colors">
              Terms of Service
            </Link>
            <Link href="/cookies" className="text-muted-foreground hover:text-accent transition-colors">
              Cookie Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
