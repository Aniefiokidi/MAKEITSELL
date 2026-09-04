// Curated suggestion lists for the vendor-facing "Product Variants" editor — the actual
// mechanism for covering new subcategories without touching cart/checkout/stock-decrement
// code again. A subcategory listed here gets a searchable, brand-grouped checklist
// (exactly today's Phone Cases UI, generalized); anything else still gets the full
// variant editor, just via "+ Add a custom variant type" with no pre-filled suggestions.
// Mirrored by hand in the mobile monorepo at packages/ui/src/variantSuggestions.ts, same
// convention already used for lib/phone-models.ts.
import { PHONE_MODEL_GROUPS, type PhoneModelGroup } from "./phone-models"

export type VariantSuggestionGroup = PhoneModelGroup // same {brand, models} shape

export const MAC_MODEL_GROUPS: VariantSuggestionGroup[] = [
  {
    brand: "MacBook Air",
    models: [
      "MacBook Air 13\" (M4)",
      "MacBook Air 15\" (M4)",
      "MacBook Air 13\" (M3)",
      "MacBook Air 15\" (M3)",
      "MacBook Air 13\" (M2)",
      "MacBook Air 15\" (M2)",
      "MacBook Air 13\" (M1)",
    ],
  },
  {
    brand: "MacBook Pro",
    models: [
      "MacBook Pro 14\" (M4/M4 Pro/M4 Max)",
      "MacBook Pro 16\" (M4 Pro/M4 Max)",
      "MacBook Pro 14\" (M3/M3 Pro/M3 Max)",
      "MacBook Pro 16\" (M3 Pro/M3 Max)",
      "MacBook Pro 13\" (M2)",
      "MacBook Pro 14\" (M2 Pro/M2 Max)",
      "MacBook Pro 16\" (M2 Pro/M2 Max)",
      "MacBook Pro 13\" (M1)",
      "MacBook Pro 16\" (Intel)",
    ],
  },
  {
    brand: "Other",
    models: ["Other / Universal fit"],
  },
]

export const AIRPODS_MODEL_GROUPS: VariantSuggestionGroup[] = [
  {
    brand: "AirPods",
    models: ["AirPods (4th gen)", "AirPods (3rd gen)", "AirPods (2nd gen)"],
  },
  {
    brand: "AirPods Pro",
    models: ["AirPods Pro (2nd gen)", "AirPods Pro (1st gen)"],
  },
  {
    brand: "AirPods Max",
    models: ["AirPods Max"],
  },
  {
    brand: "Other",
    models: ["Other / Universal fit"],
  },
]

export const TABLET_MODEL_GROUPS: VariantSuggestionGroup[] = [
  {
    brand: "iPad",
    models: ["iPad (11th gen)", "iPad (10th gen)", "iPad (9th gen)"],
  },
  {
    brand: "iPad Air",
    models: ["iPad Air 11\" (M2/M3)", "iPad Air 13\" (M2/M3)"],
  },
  {
    brand: "iPad Pro",
    models: ["iPad Pro 11\" (M4)", "iPad Pro 13\" (M4)"],
  },
  {
    brand: "iPad mini",
    models: ["iPad mini (7th gen)", "iPad mini (6th gen)"],
  },
  {
    brand: "Other",
    models: ["Other Android/Windows tablet", "Other / Universal fit"],
  },
]

export const LAPTOP_SIZE_GROUPS: VariantSuggestionGroup[] = [
  {
    brand: "Screen size",
    models: ["11\"–12\"", "13\"–14\"", "15\"–16\"", "17\" and up"],
  },
]

export const CHARGER_TYPE_GROUPS: VariantSuggestionGroup[] = [
  {
    brand: "Cables",
    models: [
      "USB-C to USB-C",
      "USB-C to Lightning",
      "Lightning to USB-A",
      "Micro-USB",
      "MagSafe cable",
    ],
  },
  {
    brand: "Wall Adapters",
    models: ["5W", "20W", "30W", "65W and up"],
  },
  {
    brand: "Wireless Chargers",
    models: ["Qi 10W", "Qi 15W", "MagSafe 15W/25W"],
  },
]

// Which subcategory shows which curated suggestion list, and under what variant label.
export const VARIANT_SUGGESTIONS: Record<string, { label: string; groups: VariantSuggestionGroup[] }> = {
  "Phone Cases": { label: "Compatible Phone Model", groups: PHONE_MODEL_GROUPS },
  "Mac Cases": { label: "Compatible MacBook Model", groups: MAC_MODEL_GROUPS },
  "AirPods Cases": { label: "Compatible AirPods Model", groups: AIRPODS_MODEL_GROUPS },
  "Tablet Cases": { label: "Compatible Tablet Model", groups: TABLET_MODEL_GROUPS },
  // Phones are the dominant screen-protector case; a vendor selling tablet protectors
  // can still add a custom variant value freely.
  "Screen Protectors": { label: "Compatible Phone Model", groups: PHONE_MODEL_GROUPS },
  // Sleeves fit by screen size, not exact model — a deliberately different shape than the
  // device-model entries above, which is exactly why this registry stores its own label
  // per subcategory rather than assuming "device model" universally.
  "Laptop Sleeves": { label: "Laptop Size", groups: LAPTOP_SIZE_GROUPS },
  "Chargers & Cables": { label: "Cable/Adapter Type", groups: CHARGER_TYPE_GROUPS },
}

// All curated labels across every registry entry, used to case-insensitively canonicalize
// a vendor's custom label input (see canonicalizeVariantLabel in product-variants.ts) —
// plus "Color" and "Size", which aren't subcategory-gated but are still canonical labels.
export const KNOWN_VARIANT_LABELS: string[] = [
  ...new Set([
    "Color",
    "Size",
    ...Object.values(VARIANT_SUGGESTIONS).map((entry) => entry.label),
  ]),
]
