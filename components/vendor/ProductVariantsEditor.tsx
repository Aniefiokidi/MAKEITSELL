"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { X, Plus } from "lucide-react"
import type { ProductVariant } from "@/lib/product-variants"
import { groupVariantsByLabel, canonicalizeVariantLabel } from "@/lib/product-variants"
import {
  VARIANT_SUGGESTIONS,
  KNOWN_VARIANT_LABELS,
  type VariantSuggestionGroup,
} from "@/lib/variant-suggestions"
import { PREDEFINED_SIZES, SHOE_SIZES, PREDEFINED_COLORS, isShoeSubcategory } from "@/lib/vendor-product-taxonomy"

// One generic "Product Variants" editor, replacing three previously-separate,
// inconsistent UIs (the Phone-Cases-only checklist, the Sizes checkbox grid with its
// Shoes-only EU-sizing special case, and the Colors checkbox grid + photo mapping). A
// vendor can add any number of independent variant groups — a curated device-model
// checklist (from lib/variant-suggestions.ts, keyed by the product's subcategory),
// Color, Size, or a fully custom label. Used identically by both the create and edit
// vendor product forms (website) — the single implementation this component exists to
// guarantee, after the earlier Shoes-sizing-never-ported-to-edit drift bug.
function getCuratedGroupsForLabel(
  label: string,
  category: string,
  subcategory: string
): VariantSuggestionGroup[] | null {
  if (label === "Color") return [{ brand: "", models: PREDEFINED_COLORS }]
  if (label === "Size") {
    return [{ brand: "", models: isShoeSubcategory(category, subcategory) ? SHOE_SIZES : PREDEFINED_SIZES }]
  }
  const suggestion = VARIANT_SUGGESTIONS[subcategory]
  if (suggestion && suggestion.label === label) return suggestion.groups
  return null
}

function getSuggestedLabelsToAdd(category: string, subcategory: string, existingLabels: string[]): string[] {
  const suggestions: string[] = []
  const deviceSuggestion = VARIANT_SUGGESTIONS[subcategory]
  if (deviceSuggestion && !existingLabels.includes(deviceSuggestion.label)) suggestions.push(deviceSuggestion.label)
  if (!existingLabels.includes("Color")) suggestions.push("Color")
  if (!existingLabels.includes("Size")) suggestions.push("Size")
  return suggestions
}

interface ProductVariantsEditorProps {
  category: string
  subcategory: string
  images: string[]
  variants: ProductVariant[]
  onVariantsChange: (variants: ProductVariant[]) => void
  colorImages: Record<string, string>
  onColorImagesChange: (colorImages: Record<string, string>) => void
}

export function ProductVariantsEditor({
  category,
  subcategory,
  images,
  variants,
  onVariantsChange,
  colorImages,
  onColorImagesChange,
}: ProductVariantsEditorProps) {
  const [customLabelInput, setCustomLabelInput] = useState("")
  const [showCustomLabelInput, setShowCustomLabelInput] = useState(false)
  const [filterByLabel, setFilterByLabel] = useState<Record<string, string>>({})
  const [newValueByLabel, setNewValueByLabel] = useState<Record<string, string>>({})
  // Labels the vendor has started (clicked "add") but has no values in yet — kept
  // separately since `variants` (a flat list) can't represent an empty group.
  const [pendingLabels, setPendingLabels] = useState<string[]>([])

  const groups = groupVariantsByLabel(variants)
  const existingLabels = groups.map((g) => g.label)
  const suggestedLabelsToAdd = getSuggestedLabelsToAdd(category, subcategory, existingLabels)

  const addLabel = (label: string) => {
    const canonical = canonicalizeVariantLabel(label, KNOWN_VARIANT_LABELS)
    if (existingLabels.includes(canonical)) return
    // An empty group isn't representable in a flat list — it appears once a value is
    // added. Nothing to do here beyond making the label "active" for the UI, which we
    // derive from a pending-labels set instead of the variants array itself.
    setPendingLabels((prev) => [...prev, canonical])
    setShowCustomLabelInput(false)
    setCustomLabelInput("")
  }

  const visibleGroups = [
    ...groups,
    ...pendingLabels.filter((l) => !existingLabels.includes(l)).map((label) => ({ label, values: [] as ProductVariant[] })),
  ]

  const removeGroup = (label: string) => {
    onVariantsChange(variants.filter((v) => v.label !== label))
    setPendingLabels((prev) => prev.filter((l) => l !== label))
    if (label === "Color") onColorImagesChange({})
  }

  const toggleValue = (label: string, value: string) => {
    const exists = variants.some((v) => v.label === label && v.value === value)
    if (exists) {
      onVariantsChange(variants.filter((v) => !(v.label === label && v.value === value)))
      if (label === "Color") {
        const next = { ...colorImages }
        delete next[value]
        onColorImagesChange(next)
      }
    } else {
      onVariantsChange([...variants, { label, value, stock: 0 }])
    }
  }

  const setStock = (label: string, value: string, stock: number) => {
    onVariantsChange(
      variants.map((v) => (v.label === label && v.value === value ? { ...v, stock: Math.max(0, stock) } : v))
    )
  }

  const addCustomValue = (label: string) => {
    const value = (newValueByLabel[label] || "").trim()
    if (!value) return
    if (variants.some((v) => v.label === label && v.value.toLowerCase() === value.toLowerCase())) return
    onVariantsChange([...variants, { label, value, stock: 0 }])
    setNewValueByLabel((prev) => ({ ...prev, [label]: "" }))
  }

  return (
    <div className="space-y-5">
      <div>
        <Label className="text-base font-semibold">Product Variants (optional)</Label>
        <p className="text-xs text-muted-foreground mt-1">
          Track stock separately for each option — a compatible device model, a color, a size, or your own custom variant.
        </p>
      </div>

      {visibleGroups.map(({ label, values }) => {
        const curatedGroups = getCuratedGroupsForLabel(label, category, subcategory)
        const filter = (filterByLabel[label] || "").toLowerCase()
        const totalStock = values.reduce((sum, v) => sum + v.stock, 0)

        return (
          <div key={label} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">{label}</h4>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeGroup(label)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            {curatedGroups ? (
              <>
                {curatedGroups.some((g) => g.brand) && (
                  <Input
                    placeholder={`Search ${label.toLowerCase()}...`}
                    value={filterByLabel[label] || ""}
                    onChange={(e) => setFilterByLabel((prev) => ({ ...prev, [label]: e.target.value }))}
                    className="h-8 text-sm"
                  />
                )}
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {curatedGroups.map((group) => {
                    const filtered = filter
                      ? group.models.filter((m) => m.toLowerCase().includes(filter))
                      : group.models
                    if (filtered.length === 0) return null
                    return (
                      <div key={group.brand || label}>
                        {group.brand && <p className="text-xs font-semibold text-muted-foreground mb-1.5">{group.brand}</p>}
                        <div className="space-y-1.5">
                          {filtered.map((value) => {
                            const entry = values.find((v) => v.value === value)
                            const isSelected = !!entry
                            return (
                              <div key={value} className="flex items-center gap-2">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleValue(label, value)}
                                  id={`${label}-${value}`}
                                />
                                <Label htmlFor={`${label}-${value}`} className="flex-1 text-sm font-normal cursor-pointer flex items-center gap-2">
                                  {label === "Color" && (
                                    <span
                                      className="inline-block w-3.5 h-3.5 rounded-full border"
                                      style={{ backgroundColor: value.toLowerCase().replace(/\s+/g, "") }}
                                    />
                                  )}
                                  {value}
                                </Label>
                                {isSelected && (
                                  <Input
                                    type="number"
                                    min="0"
                                    value={entry!.stock}
                                    onChange={(e) => setStock(label, value, Number(e.target.value) || 0)}
                                    className="h-7 w-20 text-sm"
                                    placeholder="Stock"
                                  />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder={`Add a ${label.toLowerCase()} value`}
                    value={newValueByLabel[label] || ""}
                    onChange={(e) => setNewValueByLabel((prev) => ({ ...prev, [label]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addCustomValue(label)
                      }
                    }}
                    className="h-8 text-sm"
                  />
                  <Button type="button" size="sm" variant="outline" onClick={() => addCustomValue(label)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {values.map((v) => (
                  <div key={v.value} className="flex items-center gap-2">
                    <span className="flex-1 text-sm">{v.value}</span>
                    <Input
                      type="number"
                      min="0"
                      value={v.stock}
                      onChange={(e) => setStock(label, v.value, Number(e.target.value) || 0)}
                      className="h-7 w-20 text-sm"
                      placeholder="Stock"
                    />
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleValue(label, v.value)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {label === "Color" && values.length > 0 && images.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground">Link each color to a photo</p>
                {values.map((v) => (
                  <div key={v.value} className="flex items-center gap-3">
                    <span className="text-sm min-w-24">{v.value}</span>
                    <Select
                      value={colorImages[v.value] || ""}
                      onValueChange={(url) => onColorImagesChange({ ...colorImages, [v.value]: url })}
                    >
                      <SelectTrigger className="h-8 text-sm flex-1">
                        <SelectValue placeholder="Select a photo" />
                      </SelectTrigger>
                      <SelectContent>
                        {images.map((url, i) => (
                          <SelectItem key={url} value={url}>
                            Photo {i + 1}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}

            {values.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {values.length} value{values.length === 1 ? "" : "s"} selected — {totalStock} total units in stock
              </p>
            )}
          </div>
        )
      })}

      <div className="flex flex-wrap gap-2">
        {suggestedLabelsToAdd.map((label) => (
          <Button key={label} type="button" variant="outline" size="sm" onClick={() => addLabel(label)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> {label}
          </Button>
        ))}
        {showCustomLabelInput ? (
          <div className="flex gap-2 items-center">
            <Input
              placeholder="Custom variant type (e.g. Compatible Car Model)"
              value={customLabelInput}
              onChange={(e) => setCustomLabelInput(e.target.value)}
              className="h-8 text-sm w-64"
              autoFocus
            />
            <Button type="button" size="sm" onClick={() => customLabelInput.trim() && addLabel(customLabelInput)}>
              Add
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => setShowCustomLabelInput(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Custom variant type
          </Button>
        )}
      </div>
    </div>
  )
}
