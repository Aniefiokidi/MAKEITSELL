import { NextRequest, NextResponse } from 'next/server'
import { createService } from '@/lib/mongodb-operations'
import { cacheNamespaces, invalidateCacheNamespace } from '@/lib/cache-store'
import { logApiPerformance } from '@/lib/performance-logs'

const allowedPricingTypes = new Set(['fixed', 'hourly', 'per-session', 'custom'])

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

const allowedHospitalityPropertyTypes = new Set([
  'hotel',
  'apartment',
  'short-let-apartment',
  'resort',
  'guest-house',
])

function validateServicePayload(serviceData: any): { valid: boolean; message?: string } {
  if (!serviceData || typeof serviceData !== 'object') {
    return { valid: false, message: 'Invalid service payload' }
  }

  if (!serviceData.title || typeof serviceData.title !== 'string') {
    return { valid: false, message: 'Service title is required' }
  }

  if (!serviceData.description || typeof serviceData.description !== 'string') {
    return { valid: false, message: 'Service description is required' }
  }

  if (!serviceData.category || typeof serviceData.category !== 'string') {
    return { valid: false, message: 'Service category is required' }
  }

  if (!allowedPricingTypes.has(serviceData.pricingType)) {
    return { valid: false, message: 'Invalid pricing type' }
  }

  const packageOptions = Array.isArray(serviceData.packageOptions) ? serviceData.packageOptions : []
  const addOnOptions = Array.isArray(serviceData.addOnOptions) ? serviceData.addOnOptions : []

  if (packageOptions.length > 0) {
    const defaultCount = packageOptions.filter((pkg: any) => pkg?.isDefault).length
    if (defaultCount > 1) {
      return { valid: false, message: 'Only one package can be default' }
    }

    for (const pkg of packageOptions) {
      if (!pkg || typeof pkg !== 'object') {
        return { valid: false, message: 'Invalid package option' }
      }
      if (!pkg.id || typeof pkg.id !== 'string') {
        return { valid: false, message: 'Each package must include a valid id' }
      }
      if (!pkg.name || typeof pkg.name !== 'string') {
        return { valid: false, message: 'Each package must include a name' }
      }
      if (!isFiniteNonNegativeNumber(pkg.price)) {
        return { valid: false, message: 'Each package must include a valid price' }
      }
      if (pkg.duration !== undefined && (!Number.isFinite(pkg.duration) || Number(pkg.duration) <= 0)) {
        return { valid: false, message: 'Package duration must be a positive number' }
      }
      if (!allowedPricingTypes.has(pkg.pricingType)) {
        return { valid: false, message: 'Invalid package pricing type' }
      }
      if (pkg.images !== undefined) {
        if (!Array.isArray(pkg.images) || pkg.images.some((img: any) => typeof img !== 'string' || !img.trim())) {
          return { valid: false, message: 'Package images must be an array of image URLs' }
        }
        if (pkg.images.length > 5) {
          return { valid: false, message: 'Each package can contain up to 5 images' }
        }
      }
      if (pkg.attachments !== undefined) {
        if (!Array.isArray(pkg.attachments)) {
          return { valid: false, message: 'Package attachments must be an array' }
        }
        for (const attachment of pkg.attachments) {
          if (!attachment || typeof attachment !== 'object') {
            return { valid: false, message: 'Invalid package attachment' }
          }
          if (!attachment.url || typeof attachment.url !== 'string') {
            return { valid: false, message: 'Each package attachment must include a valid URL' }
          }
          if (attachment.name !== undefined && typeof attachment.name !== 'string') {
            return { valid: false, message: 'Package attachment name must be a string' }
          }
          if (attachment.type !== undefined && typeof attachment.type !== 'string') {
            return { valid: false, message: 'Package attachment type must be a string' }
          }
        }
      }
    }
  }

  for (const addOn of addOnOptions) {
    if (!addOn || typeof addOn !== 'object') {
      return { valid: false, message: 'Invalid add-on option' }
    }
    if (!addOn.id || typeof addOn.id !== 'string') {
      return { valid: false, message: 'Each add-on must include a valid id' }
    }
    if (!addOn.name || typeof addOn.name !== 'string') {
      return { valid: false, message: 'Each add-on must include a name' }
    }
    if (addOn.pricingType !== 'fixed' && addOn.pricingType !== 'percentage') {
      return { valid: false, message: 'Add-on pricing type must be fixed or percentage' }
    }
    if (!isFiniteNonNegativeNumber(addOn.amount)) {
      return { valid: false, message: 'Add-on amount must be a valid non-negative number' }
    }
    if (addOn.pricingType === 'percentage' && Number(addOn.amount) > 100) {
      return { valid: false, message: 'Percentage add-on amount cannot exceed 100' }
    }
  }

  if (typeof serviceData.requiresQuote !== 'boolean') {
    return { valid: false, message: 'requiresQuote must be a boolean value' }
  }

  if (serviceData.quoteNotesTemplate !== undefined && typeof serviceData.quoteNotesTemplate !== 'string') {
    return { valid: false, message: 'quoteNotesTemplate must be a string' }
  }

  if (serviceData.quoteSlaHours !== undefined) {
    const quoteSlaHours = Number(serviceData.quoteSlaHours)
    if (!Number.isFinite(quoteSlaHours) || quoteSlaHours < 1 || quoteSlaHours > 168) {
      return { valid: false, message: 'quoteSlaHours must be between 1 and 168 hours' }
    }
  }

  if (serviceData.externalCalendarIcsUrl !== undefined) {
    if (typeof serviceData.externalCalendarIcsUrl !== 'string') {
      return { valid: false, message: 'externalCalendarIcsUrl must be a string' }
    }
    const trimmed = serviceData.externalCalendarIcsUrl.trim()
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      return { valid: false, message: 'externalCalendarIcsUrl must be a valid URL' }
    }
  }

  if (serviceData.calendarSyncEnabled !== undefined && typeof serviceData.calendarSyncEnabled !== 'boolean') {
    return { valid: false, message: 'calendarSyncEnabled must be a boolean value' }
  }

  if (serviceData.locationPricingRules !== undefined) {
    if (!Array.isArray(serviceData.locationPricingRules)) {
      return { valid: false, message: 'locationPricingRules must be an array' }
    }

    for (const rule of serviceData.locationPricingRules) {
      if (!rule || typeof rule !== 'object') {
        return { valid: false, message: 'Invalid location pricing rule' }
      }
      if (!rule.id || typeof rule.id !== 'string') {
        return { valid: false, message: 'Each location pricing rule must include id' }
      }
      if (!rule.label || typeof rule.label !== 'string') {
        return { valid: false, message: 'Each location pricing rule must include label' }
      }
      if (rule.matchType !== 'state' && rule.matchType !== 'city' && rule.matchType !== 'contains') {
        return { valid: false, message: 'Invalid location pricing rule matchType' }
      }
      if (!rule.matchValue || typeof rule.matchValue !== 'string') {
        return { valid: false, message: 'Each location pricing rule must include matchValue' }
      }
      if (rule.fixedAdjustment !== undefined && !Number.isFinite(Number(rule.fixedAdjustment))) {
        return { valid: false, message: 'Location fixedAdjustment must be a number' }
      }
      if (rule.percentageAdjustment !== undefined && !Number.isFinite(Number(rule.percentageAdjustment))) {
        return { valid: false, message: 'Location percentageAdjustment must be a number' }
      }
    }
  }

  if (serviceData.distanceRatePerMile !== undefined && !Number.isFinite(Number(serviceData.distanceRatePerMile))) {
    return { valid: false, message: 'distanceRatePerMile must be a number' }
  }

  if (serviceData.rentalOptions !== undefined && serviceData.rentalOptions !== null) {
    if (!serviceData.rentalOptions || typeof serviceData.rentalOptions !== 'object') {
      return { valid: false, message: 'rentalOptions must be an object' }
    }

    const numericRentalFields = ['securityDeposit', 'mileageLimitPerDay', 'overtimeFeePerHour', 'minimumDriverAge']
    for (const field of numericRentalFields) {
      const value = serviceData.rentalOptions[field]
      if (value !== undefined && !Number.isFinite(Number(value))) {
        return { valid: false, message: `rentalOptions.${field} must be a number` }
      }
    }

    if (
      serviceData.rentalOptions.requiresDriverLicense !== undefined
      && typeof serviceData.rentalOptions.requiresDriverLicense !== 'boolean'
    ) {
      return { valid: false, message: 'rentalOptions.requiresDriverLicense must be boolean' }
    }
  }

  if (serviceData.serviceSettings !== undefined && serviceData.serviceSettings !== null) {
    if (!serviceData.serviceSettings || typeof serviceData.serviceSettings !== 'object') {
      return { valid: false, message: 'serviceSettings must be an object' }
    }

    const numericSettingsFields = ['advanceNoticeHours', 'cancellationWindowHours', 'maxBookingsPerDay']
    for (const field of numericSettingsFields) {
      const value = serviceData.serviceSettings[field]
      if (value !== undefined && !Number.isFinite(Number(value))) {
        return { valid: false, message: `serviceSettings.${field} must be a number` }
      }
    }
  }

  if (serviceData.hospitalityDetails !== undefined && serviceData.hospitalityDetails !== null) {
    const details = serviceData.hospitalityDetails
    if (!details || typeof details !== 'object') {
      return { valid: false, message: 'hospitalityDetails must be an object' }
    }

    if (!allowedHospitalityPropertyTypes.has(details.propertyType)) {
      return { valid: false, message: 'Invalid hospitalityDetails.propertyType' }
    }

    if (!Number.isFinite(Number(details.totalRooms)) || Number(details.totalRooms) < 0) {
      return { valid: false, message: 'hospitalityDetails.totalRooms must be a non-negative number' }
    }

    if (!Array.isArray(details.roomTypes) || details.roomTypes.length === 0) {
      return { valid: false, message: 'hospitalityDetails.roomTypes must contain at least one room type' }
    }

    for (const room of details.roomTypes) {
      if (!room || typeof room !== 'object') {
        return { valid: false, message: 'Invalid room type in hospitalityDetails.roomTypes' }
      }
      if (!room.id || typeof room.id !== 'string') {
        return { valid: false, message: 'Each room type must include an id' }
      }
      if (!room.name || typeof room.name !== 'string') {
        return { valid: false, message: 'Each room type must include a name' }
      }
      if (!isFiniteNonNegativeNumber(Number(room.pricePerNight))) {
        return { valid: false, message: 'Each room type must include a valid pricePerNight' }
      }
      if (!Number.isFinite(Number(room.roomCount)) || Number(room.roomCount) < 0) {
        return { valid: false, message: 'Each room type must include a non-negative roomCount' }
      }
      if (!Number.isFinite(Number(room.maxGuests)) || Number(room.maxGuests) < 1) {
        return { valid: false, message: 'Each room type must include maxGuests of at least 1' }
      }
      if (!Array.isArray(room.images) || room.images.some((img: any) => typeof img !== 'string' || !img.trim())) {
        return { valid: false, message: 'Each room type must include valid image URLs' }
      }
      if (room.images.length > 10) {
        return { valid: false, message: 'Each room type can contain up to 10 images' }
      }
    }
  }

  return { valid: true }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  let statusCode = 201

  try {
    const serviceData = await request.json()
    console.log('Creating service with data:', serviceData)

    const validation = validateServicePayload(serviceData)
    if (!validation.valid) {
      statusCode = 400
      return NextResponse.json(
        { error: validation.message || 'Invalid service payload' },
        { status: 400 }
      )
    }

    const newService = await createService(serviceData)
    console.log('Service created successfully:', newService)

    await invalidateCacheNamespace(cacheNamespaces.servicesList)
    await invalidateCacheNamespace(cacheNamespaces.servicesDetail)

    return NextResponse.json({ service: newService }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating service:', error)
    console.error('Error details:', error.message, error.stack)
    statusCode = 500
    return NextResponse.json({ 
      error: 'Failed to create service',
      details: error.message 
    }, { status: 500 })
  } finally {
    void logApiPerformance({
      route: '/api/vendor/services/create',
      method: request.method,
      statusCode,
      durationMs: Date.now() - startedAt,
      cacheHit: false,
    })
  }
}