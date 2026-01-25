import { NextRequest } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { getServices, updateService, getUserById } from '@/lib/mongodb-operations'

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase()
    
    const services = await getServices({})

    // Enrich services with vendor information
    const enrichedServices = await Promise.all(services.map(async (s: any) => {
      // Lookup vendor/provider info
      let vendorName = s.providerName || 'N/A'
      let vendorEmail = 'N/A'
      
      const providerId = s.providerId || s.vendorId
      if (providerId) {
        try {
          const vendor = await getUserById(providerId)
          if (vendor) {
            vendorName = vendor.name || vendor.displayName || vendorName
            vendorEmail = vendor.email || 'N/A'
          }
        } catch (error) {
          console.error('Error fetching vendor:', error)
        }
      }

      return {
        serviceId: s._id?.toString?.() || s.id,
        serviceTitle: s.title || 'N/A',
        serviceDescription: s.description || '',
        serviceType: s.category || s.serviceType || 'N/A',
        price: s.price || 0,
        vendorId: providerId,
        vendorName,
        vendorEmail,
        status: s.status || 'active',
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }
    }))

    return new Response(JSON.stringify({ success: true, services: enrichedServices }), { status: 200 })
  } catch (error: any) {
    console.error('[/api/admin/services]', error)
    return new Response(JSON.stringify({ success: false, error: error?.message || 'Unknown error' }), { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await connectToDatabase()
    
    const body = await req.json()
    const { serviceId, status } = body

    if (!serviceId || !status) {
      return new Response(JSON.stringify({ success: false, error: 'serviceId and status are required' }), { status: 400 })
    }

    const service = await updateService(serviceId, { status, updatedAt: new Date() })

    if (!service) {
      return new Response(JSON.stringify({ success: false, error: 'Service not found' }), { status: 404 })
    }

    return new Response(JSON.stringify({ success: true, service }), { status: 200 })
  } catch (error: any) {
    console.error('[/api/admin/services PATCH]', error)
    return new Response(JSON.stringify({ success: false, error: error?.message || 'Unknown error' }), { status: 500 })
  }
}
