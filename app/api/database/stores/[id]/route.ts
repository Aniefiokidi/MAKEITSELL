import { NextRequest, NextResponse } from 'next/server'
import { getStoreById, getUserById } from '@/lib/mongodb-operations'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params
    console.log('Getting store by ID:', id)

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Store ID is required'
      }, { status: 400 })
    }

    // Check if this is a virtual store ID
    if (id.startsWith('virtual-')) {
      const vendorId = id.replace('virtual-', '')
      console.log('Fetching virtual store for vendor:', vendorId)
      
      const vendor = await getUserById(vendorId)
      
      if (!vendor) {
        return NextResponse.json({
          success: false,
          error: 'Vendor not found'
        }, { status: 404 })
      }

      // Create virtual store from vendor data
      const defaultStoreImage = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=600&fit=crop'
      const virtualStore = {
        _id: id,
        vendorId: vendor._id.toString(),
        storeName: vendor.displayName || vendor.name || `${vendor.email.split('@')[0]}'s Store`,
        storeDescription: `Welcome to ${vendor.displayName || vendor.name}'s store! Browse our quality products and services.`,
        storeImage: vendor.profileImage || defaultStoreImage,
        storeBanner: vendor.profileImage || defaultStoreImage,
        bannerImages: [vendor.profileImage || defaultStoreImage],
        category: vendor.category || 'other',
        address: vendor.address || 'Lagos, Nigeria',
        city: vendor.city || 'Lagos',
        rating: 0,
        reviewCount: 0,
        isOpen: true,
        deliveryTime: '1-3 days',
        deliveryFee: 500,
        minimumOrder: 1000,
        phone: vendor.phone || '',
        email: vendor.email,
        subscriptionStatus: 'active',
        isActive: true,
        accountStatus: 'active',
        createdAt: vendor.createdAt || new Date(),
        updatedAt: new Date()
      }

      console.log('Virtual store created:', virtualStore.storeName)
      return NextResponse.json({ success: true, data: virtualStore })
    }

    // Regular store lookup
    const store = await getStoreById(id)

    if (!store) {
      return NextResponse.json({
        success: false,
        error: 'Store not found'
      }, { status: 404 })
    }

    // Map store fields to match the /stores list endpoint
    const mappedStore = {
      ...store,
      id: store._id?.toString() || store.id,
      name: store.storeName,
      description: store.storeDescription,
      logoImage: store.storeImage || store.profileImage || store.logo,
      bannerImage: store.profileImage || store.bannerImages?.[0] || store.storeBanner || store.storeImage,
      location: store.address,
      city: store.address?.split(',')[1]?.trim() || store.address,
      // Add any other fields you want to be consistent
    };

    console.log('Store found:', mappedStore)
    return NextResponse.json({ success: true, data: mappedStore })
  } catch (error: any) {
    console.error('Get store by ID error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch store'
    }, { status: 500 })
  }
}

// PATCH: Update store by ID
import { updateStore } from '@/lib/mongodb-operations';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Store ID is required' }, { status: 400 });
    }
    const body = await request.json();
    // DEBUG: Log received body
    console.log('PATCH /stores/[id] received body:', JSON.stringify(body, null, 2));
    // Map profileImage if present
    const updateData = {
      ...body,
      profileImage: body.profileImage || '',
    };
    // DEBUG: Log updateData
    console.log('PATCH /stores/[id] updateData:', JSON.stringify(updateData, null, 2));
    await updateStore(id, updateData);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Update store error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to update store' }, { status: 500 });
  }
}