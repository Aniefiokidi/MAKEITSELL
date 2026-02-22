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
            <p className="text-accent mb-5 text-sm leading-relaxed max-w-xs mx-auto sm:mx-0">
              Your trusted marketplace with AI-powered customer service. Connecting buyers and sellers with confidence.
            </p>
            <div className="flex justify-center sm:justify-start space-x-5">
              <Link href="#" className="text-accent hover:text-accent transition-colors">
                <Facebook className="h-5 w-5 text-accent" />
              </Link>
              <Link href="#" className="text-accent hover:text-accent transition-colors">
                <Twitter className="h-5 w-5 text-accent" />
              </Link>
              <Link href="#" className="text-accent hover:text-accent transition-colors">
                <Instagram className="h-5 w-5 text-accent" />
              </Link>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-4 text-lg text-center sm:text-left text-accent">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/stores" className="text-accent">Stores</Link></li>
              <li><Link href="/categories" className="text-accent">Categories</Link></li>
              <li><Link href="/services" className="text-accent">Services</Link></li>
              <li><Link href="/products" className="text-accent">Products</Link></li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h3 className="font-semibold mb-4 text-lg text-center sm:text-left text-accent">Customer Service</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/support" className="text-accent">Help Center</Link></li>
              <li><Link href="/contact" className="text-accent">Contact Us</Link></li>
              <li><Link href="/returns" className="text-accent">Returns & Refunds</Link></li>
              <li><Link href="/shipping" className="text-accent">Shipping Info</Link></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="font-semibold mb-4 text-lg text-center sm:text-left text-accent">Contact Info</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex justify-center sm:justify-start items-center space-x-3">
                <Mail className="h-4 w-4 text-accent" />
                <span className="text-accent">noreply@makeitsell.org</span>
              </li>
              <li className="flex justify-center sm:justify-start items-center space-x-3">
                <Phone className="h-4 w-4 text-accent" />
                <span className="text-accent">+234 9077674884</span>
              </li>
              <li className="flex justify-center sm:justify-start items-center space-x-3">
                <Phone className="h-4 w-4 text-accent" />
                <span className="text-accent">+234 7031984441</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t mt-10 pt-6 flex flex-col md:flex-row justify-between items-center text-center md:text-left gap-3">
          <p className="text-accent text-sm">
            © {new Date().getFullYear()} Make It Sell Marketplace. All rights reserved.
          </p>
          <div className="flex flex-wrap justify-center md:justify-end gap-x-6 gap-y-2 text-sm">
            <Link href="/privacy" className="text-accent">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-accent">
              Terms of Service
            </Link>
            <Link href="/cookies" className="text-accent">
              Cookie Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
