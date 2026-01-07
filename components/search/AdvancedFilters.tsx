"use client"

import React, { useState, useEffect } from "react"
import { Filter, X, SlidersHorizontal, Star, Verified, Calendar, Palette, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

interface FilterOption {
  id: string
  label: string
  count?: number
  color?: string
}

interface FilterState {
  priceRange: [number, number]
  categories: string[]
  brands: string[]
  colors: string[]
  materials: string[]
  ratings: number[]
  conditions: string[]
  features: string[]
}

interface AdvancedFiltersProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  totalProducts?: number
  onReset?: () => void
  className?: string
}

// Mock filter data - replace with real API data
const filterData = {
  categories: [
    { id: "electronics", label: "Electronics", count: 1245 },
    { id: "fashion", label: "Fashion", count: 892 },
    { id: "home", label: "Home & Garden", count: 674 },
    { id: "sports", label: "Sports & Outdoors", count: 523 },
    { id: "beauty", label: "Beauty & Health", count: 445 },
    { id: "toys", label: "Toys & Games", count: 334 },
    { id: "automotive", label: "Automotive", count: 267 },
    { id: "books", label: "Books & Media", count: 198 }
  ],
  brands: [
    { id: "apple", label: "Apple", count: 156 },
    { id: "samsung", label: "Samsung", count: 134 },
    { id: "nike", label: "Nike", count: 98 },
    { id: "sony", label: "Sony", count: 87 },
    { id: "adidas", label: "Adidas", count: 76 },
    { id: "lg", label: "LG", count: 65 },
    { id: "hp", label: "HP", count: 54 },
    { id: "dell", label: "Dell", count: 43 }
  ],
  colors: [
    { id: "black", label: "Black", count: 567, color: "#000000" },
    { id: "white", label: "White", count: 432, color: "#FFFFFF" },
    { id: "blue", label: "Blue", count: 298, color: "#3B82F6" },
    { id: "red", label: "Red", count: 234, color: "#EF4444" },
    { id: "green", label: "Green", count: 189, color: "#10B981" },
    { id: "gray", label: "Gray", count: 167, color: "#6B7280" },
    { id: "pink", label: "Pink", count: 123, color: "#EC4899" },
    { id: "yellow", label: "Yellow", count: 98, color: "#F59E0B" }
  ],
  materials: [
    { id: "cotton", label: "Cotton", count: 234 },
    { id: "leather", label: "Leather", count: 187 },
    { id: "plastic", label: "Plastic", count: 156 },
    { id: "metal", label: "Metal", count: 134 },
    { id: "wood", label: "Wood", count: 98 },
    { id: "glass", label: "Glass", count: 76 },
    { id: "fabric", label: "Fabric", count: 65 },
    { id: "rubber", label: "Rubber", count: 54 }
  ],
  conditions: [
    { id: "new", label: "New", count: 1876 },
    { id: "like-new", label: "Like New", count: 234 },
    { id: "good", label: "Good Condition", count: 167 },
    { id: "fair", label: "Fair Condition", count: 89 }
  ],
  features: [
    { id: "free-shipping", label: "Free Shipping", count: 892 },
    { id: "verified-seller", label: "Verified Seller Only", count: 756 },
    { id: "new-arrivals", label: "New Arrivals (7 days)", count: 134 },
    { id: "on-sale", label: "On Sale", count: 298 },
    { id: "best-seller", label: "Best Seller", count: 156 },
    { id: "eco-friendly", label: "Eco-Friendly", count: 87 },
    { id: "handmade", label: "Handmade", count: 65 },
    { id: "local-seller", label: "Local Seller", count: 123 }
  ]
}

const priceRanges = [
  { label: "Under ₦5,000", min: 0, max: 5000 },
  { label: "₦5,000 - ₦20,000", min: 5000, max: 20000 },
  { label: "₦20,000 - ₦50,000", min: 20000, max: 50000 },
  { label: "₦50,000 - ₦100,000", min: 50000, max: 100000 },
  { label: "Above ₦100,000", min: 100000, max: 1000000 }
]

export default function AdvancedFilters({ 
  filters, 
  onFiltersChange, 
  totalProducts = 0, 
  onReset,
  className 
}: AdvancedFiltersProps) {
  const defaultFilters: FilterState = {
    priceRange: [0, 1000000],
    categories: [],
    brands: [],
    colors: [],
    materials: [],
    ratings: [],
    conditions: [],
    features: []
  }
  
  const [isOpen, setIsOpen] = useState(false)
  const [localFilters, setLocalFilters] = useState<FilterState>(filters || defaultFilters)

  // Update local filters when props change
  useEffect(() => {
    setLocalFilters(filters || defaultFilters)
  }, [filters])

  // Count active filters
  const activeFilterCount = (filters || defaultFilters) ? Object.values(filters || defaultFilters).reduce((count, value) => {
    if (Array.isArray(value)) {
      return count + value.length
    }
    if (value === (filters || defaultFilters).priceRange && (value[0] > 0 || value[1] < 1000000)) {
      return count + 1
    }
    return count
  }, 0) : 0

  // Handle filter changes
  const updateFilters = (updates: Partial<FilterState>) => {
    const newFilters = { ...localFilters, ...updates }
    setLocalFilters(newFilters)
    onFiltersChange(newFilters)
  }

  // Handle array-based filter toggles
  const toggleArrayFilter = (filterKey: keyof FilterState, value: string) => {
    const currentValues = localFilters[filterKey] as string[]
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value]
    
    updateFilters({ [filterKey]: newValues })
  }

  // Handle price range change
  const handlePriceRangeChange = (range: [number, number]) => {
    updateFilters({ priceRange: range })
  }

  // Handle quick price selection
  const handleQuickPriceSelect = (min: number, max: number) => {
    updateFilters({ priceRange: [min, max] })
  }

  // Reset all filters
  const handleReset = () => {
    const resetFilters: FilterState = {
      priceRange: [0, 1000000],
      categories: [],
      brands: [],
      colors: [],
      materials: [],
      ratings: [],
      conditions: [],
      features: []
    }
    setLocalFilters(resetFilters)
    onFiltersChange(resetFilters)
    onReset?.()
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  // Filter section component
  const FilterSection = ({ 
    title, 
    children, 
    icon 
  }: { 
    title: string
    children: React.ReactNode
    icon?: React.ReactNode 
  }) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-medium text-sm">{title}</h3>
      </div>
      {children}
    </div>
  )

  // Checkbox filter component
  const CheckboxFilter = ({ 
    options, 
    selected, 
    onToggle, 
    showCount = true 
  }: {
    options: FilterOption[]
    selected: string[]
    onToggle: (id: string) => void
    showCount?: boolean
  }) => (
    <div className="space-y-2 max-h-48 overflow-y-auto">
      {options.map((option) => (
        <div key={option.id} className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox
              id={option.id}
              checked={selected.includes(option.id)}
              onCheckedChange={() => onToggle(option.id)}
            />
            <Label 
              htmlFor={option.id} 
              className="text-sm font-normal cursor-pointer flex items-center gap-2"
            >
              {option.color && (
                <div 
                  className="w-4 h-4 rounded-full border border-gray-200"
                  style={{ backgroundColor: option.color }}
                />
              )}
              {option.label}
            </Label>
          </div>
          {showCount && option.count && (
            <span className="text-xs text-muted-foreground">({option.count})</span>
          )}
        </div>
      ))}
    </div>
  )

  const FilterContent = () => (
    <div className="space-y-6 p-6">
      {/* Price Range */}
      <FilterSection title="Price Range" icon={<SlidersHorizontal className="h-4 w-4" />}>
        <div className="space-y-4">
          <div className="px-3">
            <Slider
              value={localFilters.priceRange}
              onValueChange={handlePriceRangeChange}
              min={0}
              max={1000000}
              step={1000}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-muted-foreground mt-2">
              <span>{formatCurrency(localFilters.priceRange[0])}</span>
              <span>{formatCurrency(localFilters.priceRange[1])}</span>
            </div>
          </div>
          
          {/* Quick price selections */}
          <div className="flex flex-wrap gap-2">
            {priceRanges.map((range, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleQuickPriceSelect(range.min, range.max)}
                className={cn(
                  "text-xs h-8",
                  localFilters.priceRange[0] === range.min && 
                  localFilters.priceRange[1] === range.max && 
                  "bg-primary text-primary-foreground"
                )}
              >
                {range.label}
              </Button>
            ))}
          </div>
        </div>
      </FilterSection>

      <Separator />

      {/* Categories */}
      <FilterSection title="Categories" icon={<Package className="h-4 w-4" />}>
        <CheckboxFilter
          options={filterData.categories || []}
          selected={localFilters.categories}
          onToggle={(id) => toggleArrayFilter('categories', id)}
        />
      </FilterSection>

      <Separator />

      {/* Brands */}
      <FilterSection title="Brands">
        <CheckboxFilter
          options={filterData.brands || []}
          selected={localFilters.brands}
          onToggle={(id) => toggleArrayFilter('brands', id)}
        />
      </FilterSection>

      <Separator />

      {/* Colors */}
      <FilterSection title="Colors" icon={<Palette className="h-4 w-4" />}>
        <CheckboxFilter
          options={filterData.colors || []}
          selected={localFilters.colors}
          onToggle={(id) => toggleArrayFilter('colors', id)}
        />
      </FilterSection>

      <Separator />

      {/* Materials */}
      <FilterSection title="Materials">
        <CheckboxFilter
          options={filterData.materials || []}
          selected={localFilters.materials}
          onToggle={(id) => toggleArrayFilter('materials', id)}
        />
      </FilterSection>

      <Separator />

      {/* Ratings */}
      <FilterSection title="Customer Rating" icon={<Star className="h-4 w-4" />}>
        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map((rating) => (
            <div key={rating} className="flex items-center space-x-2">
              <Checkbox
                id={`rating-${rating}`}
                checked={localFilters.ratings.includes(rating)}
                onCheckedChange={() => toggleArrayFilter('ratings', rating.toString())}
              />
              <Label htmlFor={`rating-${rating}`} className="flex items-center gap-1 cursor-pointer">
                <div className="flex">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star 
                      key={i} 
                      className={cn(
                        "h-4 w-4",
                        i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                      )}
                    />
                  ))}
                </div>
                <span className="text-sm">& Up</span>
              </Label>
            </div>
          ))}
        </div>
      </FilterSection>

      <Separator />

      {/* Condition */}
      <FilterSection title="Condition">
        <CheckboxFilter
          options={filterData.conditions || []}
          selected={localFilters.conditions}
          onToggle={(id) => toggleArrayFilter('conditions', id)}
        />
      </FilterSection>

      <Separator />

      {/* Special Features */}
      <FilterSection title="Special Features" icon={<Verified className="h-4 w-4" />}>
        <CheckboxFilter
          options={filterData.features || []}
          selected={localFilters.features}
          onToggle={(id) => toggleArrayFilter('features', id)}
        />
      </FilterSection>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-4 border-t">
        <Button onClick={handleReset} variant="outline" className="flex-1">
          Reset All
        </Button>
        <Button onClick={() => setIsOpen(false)} className="flex-1">
          Apply Filters
        </Button>
      </div>
    </div>
  )

  return (
    <div className={className}>
      {/* Filter Button for All Screen Sizes */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" className="gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="p-6 pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </SheetTitle>
            <SheetDescription>
              {totalProducts > 0 && `${totalProducts.toLocaleString()} products found`}
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-120px)]">
            <FilterContent />
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="mt-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium">Active Filters</h4>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Clear All
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {localFilters.categories.map(category => (
              <Badge key={category} variant="secondary" className="gap-1">
                {(filterData.categories || []).find(c => c.id === category)?.label}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => toggleArrayFilter('categories', category)}
                />
              </Badge>
            ))}
            {localFilters.brands.map(brand => (
              <Badge key={brand} variant="secondary" className="gap-1">
                {(filterData.brands || []).find(b => b.id === brand)?.label}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => toggleArrayFilter('brands', brand)}
                />
              </Badge>
            ))}
            {(localFilters.priceRange[0] > 0 || localFilters.priceRange[1] < 1000000) && (
              <Badge variant="secondary" className="gap-1">
                {formatCurrency(localFilters.priceRange[0])} - {formatCurrency(localFilters.priceRange[1])}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => updateFilters({ priceRange: [0, 1000000] })}
                />
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  )
}