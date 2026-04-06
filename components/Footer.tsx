import Link from "next/link"
import { Facebook, Instagram, Mail, Phone } from "lucide-react"

export default function Footer() {
  return (
    <footer className="bg-muted/50 border-t">
      <div className="container mx-auto px-[clamp(0.875rem,3.8vw,1.5rem)] py-[clamp(1.75rem,7vw,2.5rem)]">
        {/* Top Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[clamp(1.25rem,5vw,2.5rem)] text-center sm:text-left">
          {/* Company Info */}
          <div>
            <Link href="/" className="flex justify-center sm:justify-start items-center mb-4">
              <img
                src="/images/logo (2).png"
                alt="Logo"
                className="h-[clamp(1.5rem,6vw,2rem)] w-auto object-contain transition-transform duration-300 hover:scale-105"
              />
            </Link>
            <p className="text-accent mb-5 text-[clamp(0.84rem,3.5vw,0.95rem)] leading-relaxed max-w-xs mx-auto sm:mx-0">
              Your trusted marketplace with AI-powered customer service. Connecting buyers and sellers with confidence.
            </p>
            <div className="flex justify-center sm:justify-start space-x-5">
              <span className="text-accent/60" title="Facebook link coming soon" aria-label="Facebook link coming soon">
                <Facebook className="h-5 w-5 text-accent" />
              </span>
              <Link
                href="https://x.com/makeitsellorg"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:text-accent transition-colors"
                aria-label="Follow Make It Sell on X"
              >
                <svg className="h-5 w-5 text-accent" viewBox="0 0 24 24" fill="currentColor" aria-label="X">
                  <path d="M18.244 2H21l-6.56 7.496L22.5 22h-6.3l-4.934-6.458L5.53 22H2.77l7.014-8.014L1.5 2h6.46l4.46 5.893L18.244 2zm-2.208 18h1.64L7.067 3.896H5.31L16.036 20z" />
                </svg>
              </Link>
              <Link
                href="https://www.instagram.com/makeitsell.ng/?__pwa=1"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:text-accent transition-colors"
                aria-label="Follow Make It Sell on Instagram"
              >
                <Instagram className="h-5 w-5 text-accent" />
              </Link>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-4 text-[clamp(1rem,4.2vw,1.125rem)] text-center sm:text-left text-accent">Quick Links</h3>
            <ul className="space-y-2 text-[clamp(0.84rem,3.5vw,0.95rem)]">
              <li><Link href="/stores" className="text-accent">Stores</Link></li>
              <li><Link href="/categories" className="text-accent">Categories</Link></li>
              <li><Link href="/services" className="text-accent">Services</Link></li>
              <li><Link href="/bidding" className="text-accent">Bidding</Link></li>
              <li><Link href="/products" className="text-accent">Products</Link></li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h3 className="font-semibold mb-4 text-[clamp(1rem,4.2vw,1.125rem)] text-center sm:text-left text-accent">Customer Service</h3>
            <ul className="space-y-2 text-[clamp(0.84rem,3.5vw,0.95rem)]">
              <li><Link href="/contact" className="text-accent">Help</Link></li>
              <li><Link href="/contact?tab=contact" className="text-accent">Contact Team</Link></li>
              <li><Link href="/contact?tab=support" className="text-accent">Support Center</Link></li>
              <li><Link href="/returns" className="text-accent">Returns & Refunds</Link></li>
              <li><Link href="/shipping" className="text-accent">Shipping Info</Link></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="font-semibold mb-4 text-[clamp(1rem,4.2vw,1.125rem)] text-center sm:text-left text-accent">Contact Info</h3>
            <ul className="space-y-3 text-[clamp(0.84rem,3.5vw,0.95rem)]">
              <li className="flex justify-center sm:justify-start items-center space-x-3">
                <Mail className="h-4 w-4 text-accent" />
                <span className="text-accent">support@makeitsell.ng</span>
              </li>
              <li className="flex justify-center sm:justify-start items-center space-x-3">
                <Phone className="h-4 w-4 text-accent" />
                <span className="text-accent">+234 9077674884</span>
              </li>
              <li className="flex justify-center sm:justify-start items-center space-x-3">
                <Phone className="h-4 w-4 text-accent" />
                <span className="text-accent">+234 7031984441</span>
              </li>
              <li className="flex justify-center sm:justify-start items-center space-x-3">
                <Phone className="h-4 w-4 text-accent" />
                <span className="text-accent">+234 8025282040</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t mt-[clamp(1.5rem,6vw,2.5rem)] pt-[clamp(1rem,4vw,1.5rem)] flex flex-col md:flex-row justify-between items-center text-center md:text-left gap-3">
          <p className="text-accent text-[clamp(0.84rem,3.5vw,0.95rem)]">
            © {new Date().getFullYear()} Make It Sell Marketplace. All rights reserved.
          </p>
          <div className="flex flex-wrap justify-center md:justify-end gap-x-6 gap-y-2 text-[clamp(0.84rem,3.5vw,0.95rem)]">
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
