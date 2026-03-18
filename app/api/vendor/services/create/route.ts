import { NextRequest, NextResponse } from 'next/server'
import { createService } from '@/lib/mongodb-operations'
import { cacheNamespaces, invalidateCacheNamespace } from '@/lib/cache-store'
import { logApiPerformance } from '@/lib/performance-logs'

const allowedPricingTypes = new Set(['fixed', 'hourly', 'per-session', 'custom'])

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

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