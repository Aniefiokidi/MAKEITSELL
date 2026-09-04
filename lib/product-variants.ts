// Generalized per-variant stock — replaces the Phone-Cases-only `compatiblePhoneModels`
// special case with something any product can use: a specific compatible device model, a
// color, a size, or a vendor's own custom dimension (e.g. "Compatible Car Model"). See
// lib/models/Product.ts's `variants` field comment for the full data-model rationale.
// Mirrored by hand in the mobile monorepo at packages/ui/src/productVariants.ts, same
// convention already used for lib/phone-models.ts.
import { normalizeCompatiblePhoneModels } from "./phone-models"

export type ProductVariant = { label: string; value: string; stock: number }

type LegacyVariantSource = {
  variants?: Array<{ label: string; value: string; stock: number }> | null
  compatiblePhoneModels?: Array<{ model: string; stock: number }> | string[] | null
  colors?: string[] | null
  sizes?: string[] | null
}

// Reads `variants` if present; otherwise synthesizes entries from the legacy
// compatiblePhoneModels/colors/sizes fields. Every reader of variant data (vendor forms,
// buyer pages, cart, stock decrement) goes through this one function — it never merges
// `variants` with the legacy fields, so a product with ANY `variants` entries is assumed
// to be fully migrated. Vendor-form edit screens MUST seed their initial state from this
// function's output, never from the raw legacy fields directly, or a save can silently
// drop legacy data the moment `variants` becomes non-empty (see lib/models/Product.ts).
export function normalizeProductVariants(product: LegacyVariantSource | null | undefined): ProductVariant[] {
  if (!product) return []
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    return product.variants.map((entry) => ({
      label: String(entry.label),
      value: String(entry.value),
      stock: Number(entry.stock) || 0,
    }))
  }

  const legacy: ProductVariant[] = []

  const phoneModels = normalizeCompatiblePhoneModels(product.compatiblePhoneModels ?? undefined)
  for (const { model, stock } of phoneModels) {
    legacy.push({ label: "Compatible Phone Model", value: model, stock })
  }

  // Colors/sizes never had real per-value stock — conservatively 0, same "vendor must
  // set a real number" default already established for legacy phone-model strings.
  for (const color of product.colors || []) {
    legacy.push({ label: "Color", value: color, stock: 0 })
  }
  for (const size of product.sizes || []) {
    legacy.push({ label: "Size", value: size, stock: 0 })
  }

  return legacy
}

// Groups a flat variant list by label, preserving first-seen label order — used by every
// buyer-facing picker (one pill section per label) and the vendor variant editor.
export function groupVariantsByLabel(variants: ProductVariant[]): Array<{ label: string; values: ProductVariant[] }> {
  const order: string[] = []
  const byLabel = new Map<string, ProductVariant[]>()
  for (const variant of variants) {
    if (!byLabel.has(variant.label)) {
      byLabel.set(variant.label, [])
      order.push(variant.label)
    }
    byLabel.get(variant.label)!.push(variant)
  }
  return order.map((label) => ({ label, values: byLabel.get(label)! }))
}

// Case-insensitive match against a set of known labels (e.g. the curated registry's
// labels) so a vendor typing "color" reuses the canonical "Color" instead of fragmenting
// into a second, differently-cased dimension. Returns the canonical label if found,
// otherwise the input trimmed as-is (a genuinely new custom label).
export function canonicalizeVariantLabel(inputLabel: string, knownLabels: string[]): string {
  const trimmed = inputLabel.trim()
  const match = knownLabels.find((known) => known.toLowerCase() === trimmed.toLowerCase())
  return match || trimmed
}

// Canonical cart-line identity for a set of selected variants — sort by (label, value)
// case-insensitively, join each pair, join pairs with "|". An empty/undefined selection
// and an explicitly empty array both produce "", matching how a non-variant item's
// selection has always compared equal. This exact algorithm must be replicated
// byte-for-byte on the mobile app (apps/customer/context/CartContext.tsx) since there is
// no shared cart package between the two codebases.
export function canonicalSelectedVariantsKey(
  selectedVariants?: Array<{ label: string; value: string }> | null
): string {
  if (!selectedVariants || selectedVariants.length === 0) return ""
  return selectedVariants
    .map(({ label, value }) => `${label.toLowerCase()}::${value.toLowerCase()}`)
    .sort()
    .join("|")
}
