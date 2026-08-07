// Shared services-category list — canonical source was (is) the inline SERVICE_CATEGORIES
// array in app/services/page.tsx. Extracted here on the same principle as
// lib/product-categories.ts, so the WhatsApp bot's category menu doesn't duplicate/drift
// from the web filter list.
//
// One addition beyond a straight copy: "beauty" is added below. It's absent from the web
// page's own list despite being a real, actively-used category (the single largest
// category in the live catalog as of writing) — the web filter page can't surface it at
// all, a pre-existing gap left as-is there since fixing app/services/page.tsx wasn't part
// of this WhatsApp browsing task. Omitting it here too would make the bot's "browse by
// category" menu unable to reach the biggest slice of real inventory, so it's included.
export interface ServiceCategory {
  slug: string
  name: string
}

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  { slug: "beauty", name: "Beauty & Grooming" },
  { slug: "photography", name: "Photography" },
  { slug: "consulting", name: "Consulting" },
  { slug: "repairs", name: "Repairs & Maintenance" },
  { slug: "design", name: "Design & Creative" },
  { slug: "fitness", name: "Fitness & Wellness" },
  { slug: "education", name: "Education & Tutoring" },
  { slug: "cleaning", name: "Cleaning Services" },
  { slug: "tech", name: "Tech Support" },
  { slug: "rentals", name: "Rentals" },
  { slug: "hospitality", name: "Hotels & Apartments" },
  { slug: "marketing", name: "Marketing" },
  { slug: "legal", name: "Legal Services" },
  { slug: "healthcare", name: "Healthcare & Wellness" },
  { slug: "logistics", name: "Logistics & Delivery" },
  { slug: "home-improvement", name: "Home Improvement" },
  { slug: "automotive", name: "Automotive Services" },
  { slug: "event-planning", name: "Event Planning" },
  { slug: "moving-relocation", name: "Moving & Relocation" },
  { slug: "pet-care", name: "Pet Care" },
  { slug: "childcare", name: "Childcare" },
  { slug: "elderly-care", name: "Elderly Care" },
  { slug: "laundry-drycleaning", name: "Laundry & Dry Cleaning" },
  { slug: "catering", name: "Catering & Food Services" },
  { slug: "real-estate", name: "Real Estate Services" },
  { slug: "accounting-tax", name: "Accounting & Tax" },
  { slug: "writing-translation", name: "Writing & Translation" },
  { slug: "software-development", name: "Software Development" },
  { slug: "virtual-assistant", name: "Virtual Assistant" },
  { slug: "security-services", name: "Security Services" },
  { slug: "other", name: "Other Services" },
]
