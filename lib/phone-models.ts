// Curated, brand-grouped phone model list for the "compatible phone models" attribute on
// Phone Cases listings (category: Electronics, subcategory: Phone Cases). A starting list
// covering recent + popular models in the Nigerian market — plain array entries, trivial
// to extend as new phones release. Mirrored by hand in the mobile monorepo at
// packages/ui/src/phoneModels.ts, same convention already used for product categories.
export type PhoneModelGroup = {
  brand: string
  models: string[]
}

export type PhoneModelStock = { model: string; stock: number }

// Normalizes either shape of Product.compatiblePhoneModels into the current
// {model, stock} shape. A legacy plain-string entry (from before per-model stock
// existed) becomes stock: 0 — conservatively "not known to be in stock" rather than
// assuming availability, until a vendor opens the edit form and sets a real number.
export function normalizeCompatiblePhoneModels(
  value: Array<{ model: string; stock: number }> | string[] | null | undefined
): PhoneModelStock[] {
  if (!Array.isArray(value)) return []
  return value.map((entry) =>
    typeof entry === "string" ? { model: entry, stock: 0 } : { model: entry.model, stock: Number(entry.stock) || 0 }
  )
}

export const PHONE_MODEL_GROUPS: PhoneModelGroup[] = [
  {
    brand: "Apple",
    models: [
      "iPhone 17 Pro Max",
      "iPhone 17 Pro",
      "iPhone 17",
      "iPhone Air",
      "iPhone 16 Pro Max",
      "iPhone 16 Pro",
      "iPhone 16 Plus",
      "iPhone 16",
      "iPhone 15 Pro Max",
      "iPhone 15 Pro",
      "iPhone 15 Plus",
      "iPhone 15",
      "iPhone 14 Pro Max",
      "iPhone 14 Pro",
      "iPhone 14 Plus",
      "iPhone 14",
      "iPhone 13 Pro Max",
      "iPhone 13 Pro",
      "iPhone 13",
      "iPhone 13 Mini",
      "iPhone 12",
      "iPhone 11",
      "iPhone SE",
    ],
  },
  {
    brand: "Samsung",
    models: [
      "Galaxy S25 Ultra",
      "Galaxy S25+",
      "Galaxy S25",
      "Galaxy S24 Ultra",
      "Galaxy S24+",
      "Galaxy S24",
      "Galaxy S23 Ultra",
      "Galaxy S23",
      "Galaxy A55",
      "Galaxy A54",
      "Galaxy A34",
      "Galaxy A24",
      "Galaxy A15",
      "Galaxy A05",
      "Galaxy Note 20",
    ],
  },
  {
    brand: "Tecno",
    models: [
      "Camon 30",
      "Camon 20",
      "Spark 20",
      "Spark 10",
      "Phantom X2",
      "Pova 6",
    ],
  },
  {
    brand: "Infinix",
    models: [
      "Note 40",
      "Note 30",
      "Hot 40",
      "Hot 30",
      "Zero 30",
      "Smart 8",
    ],
  },
  {
    brand: "itel",
    models: [
      "itel A70",
      "itel A60s",
      "itel S23",
      "itel P55",
    ],
  },
  {
    brand: "Xiaomi",
    models: [
      "Redmi Note 13",
      "Redmi Note 12",
      "Redmi 13C",
      "Xiaomi 14",
      "POCO X6",
    ],
  },
  {
    brand: "Other",
    models: ["Other / Universal fit"],
  },
]
