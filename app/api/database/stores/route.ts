// Helper to clean state options
const cleanStateOptions = (rawOptions: any[]): string[] => {
  return [...new Set(
    (rawOptions || [])
      .filter(Boolean)
      .map((s: any) => String(s).trim())
      .filter((s) =>
        s.length > 0 &&
        !s.includes(',') &&
        !/nigeria/i.test(s) &&
        !/\d/.test(s) &&           // no entries with digits
        s.split(' ').length <= 5   // reasonable state name length
      )
  )].sort((a, b) => a.localeCompare(b))
}
import { NextRequest, NextResponse } from 'next/server'
import { getStores as mongoGetStores } from '@/lib/mongodb-operations'
import { requireRoles } from '@/lib/server-route-auth'
import connectToDatabase from '@/lib/mongodb'
import { Store } from '@/lib/models/Store'
import { Product } from '@/lib/models/Product'

const slugifyPublic = (value: string): string => {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const randomSlugSuffix = () => Math.random().toString(36).slice(2, 7)

const generateUniqueStoreSlug = async (name: string, excludeId?: any): Promise<string> => {
  const baseSlug = slugifyPublic(name) || 'store'
  let candidate = baseSlug
  let attempts = 0

  while (attempts < 20) {
    const query: any = { publicSlug: candidate }
    if (excludeId) query._id = { $ne: excludeId }
    const exists = await Store.exists(query)
    if (!exists) return candidate

    attempts += 1
    candidate = `${baseSlug}-${randomSlugSuffix()}`
  }

  return `${baseSlug}-${Date.now().toString(36)}`
}

const ensureStoreSlug = async (store: any): Promise<string> => {
  const existingSlug = String(store?.publicSlug || '').trim()
  if (existingSlug) return existingSlug

  const generatedSlug = await generateUniqueStoreSlug(String(store?.storeName || 'store'), store?._id)
  if (store?._id) {
    await Store.updateOne({ _id: store._id }, { $set: { publicSlug: generatedSlug } })
  }

  return generatedSlug
}

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase()

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || undefined
    const isOpen = searchParams.get('isOpen') === 'true' ? true : undefined
    const parsedLimit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 20
    const limitCount = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 20
    const parsedPage = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1
    const page = Number.isFinite(parsedPage) ? Math.max(parsedPage, 1) : 1
    const skip = (page - 1) * limitCount
    const vendorId = searchParams.get('vendorId') || undefined
    const search = (searchParams.get('search') || '').trim().toLowerCase()
    const location = (searchParams.get('location') || '').trim().toLowerCase()
    const sortBy = searchParams.get('sortBy') || 'for-you'

    const query: any = {}
    if (category) query.category = category
    if (isOpen !== undefined) query.isOpen = isOpen
    if (vendorId) query.vendorId = vendorId

    if (search) {
      const searchRegex = new RegExp(search, 'i')
      query.$or = [
        { storeName: searchRegex },
        { storeDescription: searchRegex },
        { category: searchRegex },
        { address: searchRegex },
      ]
    }

    if (location) {
      query.address = new RegExp(location, 'i')
    }

    const total = await Store.countDocuments(query)

    if (sortBy === 'products') {
      const productSortedStores = await Store.aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'products',
            let: { vendorKey: '$vendorId' },
            pipeline: [
              { $match: { $expr: { $eq: ['$vendorId', '$$vendorKey'] } } },
              { $sort: { createdAt: -1 } },
              {
                $group: {
                  _id: '$vendorId',
                  productCount: { $sum: 1 },
                  firstProductImage: { $first: { $arrayElemAt: ['$images', 0] } },
                },
              },
            ],
            as: 'productMeta',
          },
        },
        {
          $addFields: {
            productCount: { $ifNull: [{ $arrayElemAt: ['$productMeta.productCount', 0] }, 0] },
            firstProductImage: { $arrayElemAt: ['$productMeta.firstProductImage', 0] },
          },
        },
        { $sort: { isOpen: -1, productCount: -1, storeName: 1 } },
        { $skip: skip },
        { $limit: limitCount },
      ])

      const mappedStores = await Promise.all(productSortedStores.map(async (store: any) => ({
        ...store,
        publicSlug: await ensureStoreSlug(store),
        id: store._id?.toString() || store.id,
        name: store.storeName,
        description: store.storeDescription,
        logoImage: store.storeImage || store.profileImage || store.logo,
        bannerImage: store.profileImage || store.firstProductImage || store.bannerImages?.[0] || store.storeBanner || store.storeImage,
        productImages: store.firstProductImage ? [store.firstProductImage] : [],
        location: store.address,
        city: store.city || store.address?.split(',')[1]?.trim() || store.address,
        state: store.state || '',
        bankName: store.bankName || '',
        bankCode: store.bankCode || '',
        accountNumber: store.accountNumber || '',
        accountName: store.accountName || '',
        accountVerified: !!store.accountVerified,
        walletBalance: typeof store.walletBalance === 'number' ? store.walletBalance : 0,
        linkedWalletUserId: store.linkedWalletUserId || store.vendorId,
      })))

      const stateOptions = await Store.distinct('state', query)
      return NextResponse.json({
        success: true,
        data: mappedStores,
        pagination: {
          page,
          limit: limitCount,
          total,
          totalPages: Math.max(1, Math.ceil(total / limitCount)),
        },
        locationOptions: cleanStateOptions(stateOptions),
      })
    }

    if (sortBy === 'for-you') {
      const forYouStores = await Store.aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'products',
            let: { vendorKey: '$vendorId' },
            pipeline: [
              { $match: { $expr: { $eq: ['$vendorId', '$$vendorKey'] } } },
              { $sort: { createdAt: -1 } },
              {
                $group: {
                  _id: '$vendorId',
                  productCount: { $sum: 1 },
                  firstProductImage: { $first: { $arrayElemAt: ['$images', 0] } },
                },
              },
            ],
            as: 'productMeta',
          },
        },
        {
          $addFields: {
            productCount: { $ifNull: [{ $arrayElemAt: ['$productMeta.productCount', 0] }, 0] },
            firstProductImage: { $arrayElemAt: ['$productMeta.firstProductImage', 0] },
            hasLogoImage: {
              $or: [
                {
                  $and: [
                    { $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ['$storeImage', ''] } } } }, 0] },
                    { $not: { $regexMatch: { input: { $toLower: { $trim: { input: { $ifNull: ['$storeImage', ''] } } } }, regex: '(placeholder|default|no[-_ ]?image)' } } },
                  ],
                },
                {
                  $and: [
                    { $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ['$logo', ''] } } } }, 0] },
                    { $not: { $regexMatch: { input: { $toLower: { $trim: { input: { $ifNull: ['$logo', ''] } } } }, regex: '(placeholder|default|no[-_ ]?image)' } } },
                  ],
                },
              ],
            },
            hasStoreCardImage: {
              $or: [
                '$hasLogoImage',
                {
                  $and: [
                    { $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ['$profileImage', ''] } } } }, 0] },
                    { $not: { $regexMatch: { input: { $toLower: { $trim: { input: { $ifNull: ['$profileImage', ''] } } } }, regex: '(placeholder|default|no[-_ ]?image)' } } },
                  ],
                },
                {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: { $ifNull: ['$bannerImages', []] },
                          as: 'img',
                          cond: {
                            $and: [
                              { $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ['$$img', ''] } } } }, 0] },
                              { $not: { $regexMatch: { input: { $toLower: { $trim: { input: { $ifNull: ['$$img', ''] } } } }, regex: '(placeholder|default|no[-_ ]?image)' } } },
                            ],
                          },
                        },
                      },
                    },
                    0,
                  ],
                },
                {
                  $and: [
                    { $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ['$storeBanner', ''] } } } }, 0] },
                    { $not: { $regexMatch: { input: { $toLower: { $trim: { input: { $ifNull: ['$storeBanner', ''] } } } }, regex: '(placeholder|default|no[-_ ]?image)' } } },
                  ],
                },
              ],
            },
            hasProducts: { $gt: [{ $ifNull: [{ $arrayElemAt: ['$productMeta.productCount', 0] }, 0] }, 0] },
          },
        },
        {
          $addFields: {
            setupTier: {
              $switch: {
                branches: [
                  {
                    case: { $and: ['$hasStoreCardImage', '$hasProducts'] },
                    then: 4,
                  },
                  {
                    case: '$hasStoreCardImage',
                    then: 3,
                  },
                  {
                    case: '$hasProducts',
                    then: 2,
                  },
                ],
                default: 1,
              },
            },
            openSort: {
              $cond: [
                { $eq: [{ $ifNull: ['$isOpen', true] }, true] },
                1,
                0,
              ],
            },
            isPinnedJlc: {
              $cond: [
                {
                  $and: [
                    {
                      $eq: [
                        {
                          $toLower: {
                            $trim: {
                              input: { $ifNull: ['$storeName', ''] },
                            },
                          },
                        },
                        'jlc',
                      ],
                    },
                    { $eq: [{ $ifNull: ['$isOpen', true] }, true] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
        { $sort: { openSort: -1, isPinnedJlc: -1, setupTier: -1, hasLogoImage: -1, hasStoreCardImage: -1, productCount: -1, createdAt: -1, storeName: 1 } },
        { $skip: skip },
        { $limit: limitCount },
      ])

      const mappedStores = await Promise.all(forYouStores.map(async (store: any) => ({
        ...store,
        publicSlug: await ensureStoreSlug(store),
        id: store._id?.toString() || store.id,
        name: store.storeName,
        description: store.storeDescription,
        logoImage: store.storeImage || store.profileImage || store.logo,
        bannerImage: store.profileImage || store.firstProductImage || store.bannerImages?.[0] || store.storeBanner || store.storeImage,
        productImages: store.firstProductImage ? [store.firstProductImage] : [],
        location: store.address,
        city: store.city || store.address?.split(',')[1]?.trim() || store.address,
        state: store.state || '',
        bankName: store.bankName || '',
        bankCode: store.bankCode || '',
        accountNumber: store.accountNumber || '',
        accountName: store.accountName || '',
        accountVerified: !!store.accountVerified,
        walletBalance: typeof store.walletBalance === 'number' ? store.walletBalance : 0,
        linkedWalletUserId: store.linkedWalletUserId || store.vendorId,
      })))

      const locationOptions = await Store.distinct('address', query)
      const stateOptions = await Store.distinct('state', query)
      return NextResponse.json({
        success: true,
        data: mappedStores,
        pagination: {
          page,
          limit: limitCount,
          total,
          totalPages: Math.max(1, Math.ceil(total / limitCount)),
        },
        locationOptions: cleanStateOptions(stateOptions),
      })
    }

    const findSort: Record<string, 1 | -1> =
      sortBy === 'newest'
        ? { isOpen: -1, createdAt: -1 }
        : { isOpen: -1, storeName: 1, createdAt: -1 }

    let storesPage = await Store.find(query)
      .sort(findSort)
      .skip(skip)
      .limit(limitCount)
      .lean()

    const vendorIds = Array.from(new Set(storesPage.map((store: any) => String(store.vendorId || '')).filter(Boolean)))

    const productCounts = vendorIds.length
      ? await Product.aggregate([
          { $match: { vendorId: { $in: vendorIds } } },
          { $group: { _id: '$vendorId', productCount: { $sum: 1 } } },
        ])
      : []

    const productFirstImages = vendorIds.length
      ? await Product.aggregate([
          { $match: { vendorId: { $in: vendorIds } } },
          { $sort: { createdAt: -1 } },
          {
            $group: {
              _id: '$vendorId',
              firstProductImage: { $first: { $arrayElemAt: ['$images', 0] } },
            },
          },
        ])
      : []

    const productCountByVendor = new Map<string, number>()
    for (const item of productCounts as any[]) {
      productCountByVendor.set(String(item._id), Number(item.productCount || 0))
    }

    const firstImageByVendor = new Map<string, string>()
    for (const item of productFirstImages as any[]) {
      if (!item.firstProductImage) continue
      firstImageByVendor.set(String(item._id), String(item.firstProductImage))
    }

    let mappedStores = await Promise.all(storesPage.map(async (store: any) => {
      const vendorKey = String(store.vendorId || '')
      const firstProductImage = firstImageByVendor.get(vendorKey) || null
      const productCount = productCountByVendor.get(vendorKey) || 0

      return {
        ...store,
        publicSlug: await ensureStoreSlug(store),
        id: store._id?.toString() || store.id,
        name: store.storeName,
        description: store.storeDescription,
        logoImage: store.storeImage || store.profileImage || store.logo,
        bannerImage: store.profileImage || firstProductImage || store.bannerImages?.[0] || store.storeBanner || store.storeImage,
        productImages: firstProductImage ? [firstProductImage] : [],
        location: store.address,
        city: store.city || store.address?.split(',')[1]?.trim() || store.address,
        state: store.state || '',
        productCount,
        bankName: store.bankName || '',
        bankCode: store.bankCode || '',
        accountNumber: store.accountNumber || '',
        accountName: store.accountName || '',
        accountVerified: !!store.accountVerified,
        walletBalance: typeof store.walletBalance === 'number' ? store.walletBalance : 0,
        linkedWalletUserId: store.linkedWalletUserId || store.vendorId,
      }
    }))

    // Return unique states for location filter
    const stateOptions = await Store.distinct('state', query)
    return NextResponse.json({
      success: true,
      data: mappedStores,
      pagination: {
        page,
        limit: limitCount,
        total,
        totalPages: Math.max(1, Math.ceil(total / limitCount)),
      },
      locationOptions: cleanStateOptions(stateOptions),
    })
  } catch (error: any) {
    console.error('Get stores error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch stores',
      data: []
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireRoles(request, ['vendor', 'admin'])
  if (response) return response

  try {
    const storeData = await request.json()
    console.log('Creating store with data:', storeData)

    const enforcedVendorId = user?.role === 'vendor' ? user.id : storeData.vendorId
    const existingStoresForVendor = await mongoGetStores({
      vendorId: enforcedVendorId,
      limitCount: 6,
    })

    if (Array.isArray(existingStoresForVendor) && existingStoresForVendor.length >= 5) {
      return NextResponse.json(
        {
          success: false,
          error: 'Store limit reached. You can create at most 5 stores.',
        },
        { status: 400 }
      )
    }

    const walletUserId = user?.role === 'vendor'
      ? user.id
      : (storeData.linkedWalletUserId || storeData.vendorId)
    
    // Map the data from signup form to the MongoDB store schema
    const mappedStoreData = {
      vendorId: enforcedVendorId,
      storeName: storeData.storeName || storeData.name,
      storeDescription: storeData.storeDescription || storeData.description,
      storeImage: storeData.storeImage || storeData.logoImage || '',
      profileImage: storeData.profileImage || '',
      storeBanner: storeData.bannerImage,
      category: storeData.category || storeData.storeCategory,
      reviewCount: storeData.reviewCount || 0,
      isOpen: storeData.isOpen !== undefined ? storeData.isOpen : true,
      deliveryTime: storeData.deliveryTime || "30-60 min",
      deliveryFee: storeData.deliveryFee || 500,
      minimumOrder: storeData.minimumOrder || 2000,
      address: storeData.address || storeData.location || '',
      city: storeData.city || '',
      state: storeData.state || '',
      phone: storeData.phone || storeData.storePhone,
      email: storeData.email,
      walletBalance: typeof storeData.walletBalance === 'number' ? storeData.walletBalance : 0,
      linkedWalletUserId: walletUserId,
    }

    console.log('Mapped store data:', mappedStoreData)

    // Validate required fields
    const requiredFields = ['vendorId', 'storeName', 'storeDescription', 'storeImage', 'category', 'deliveryTime', 'address']
    const missingFields = requiredFields.filter(field => !mappedStoreData[field as keyof typeof mappedStoreData])
    
    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields)
      return NextResponse.json({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`
      }, { status: 400 })
    }

    // Create store in MongoDB
    const { createStore } = await import('@/lib/mongodb-operations')
    const storeId = await createStore(mappedStoreData)
    
    console.log('Store created successfully with ID:', storeId)
    return NextResponse.json({ success: true, id: storeId })
  } catch (error: any) {
    console.error('Create store error:', error)
    return NextResponse.json({
      success: false,
      error: `Failed to create store: ${error.message}`
    }, { status: 500 })
  }
}