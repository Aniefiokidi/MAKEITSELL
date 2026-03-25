import { NextRequest, NextResponse } from 'next/server'
import { xoroPayService } from '@/lib/xoro-pay'
import { paystackService } from '@/lib/payment'
import { createOrder, updateOrder, creditVendorWalletsForOrder } from '@/lib/mongodb-operations'
import { v4 as uuidv4 } from 'uuid'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { Store } from '@/lib/models/Store'
import crypto from 'crypto'
import { calculatePaystackCheckoutAmounts } from '@/lib/paystack-charges'
import { estimateShippingFee } from '@/lib/aco-logistics-rates'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Payment API received:', body)
    
    const {
      items,
      shippingInfo,
      paymentMethod,
      customerId,
      totalAmount: clientTotalAmount
    } = body

    // Validate required fields
    if (!items || !shippingInfo || !customerId || !shippingInfo.email || !String(shippingInfo.deliveryInstructions || '').trim()) {
      console.error('Missing fields:', {
        items,
        shippingInfo,
        customerId,
        clientTotalAmount,
        email: shippingInfo?.email,
        deliveryInstructions: shippingInfo?.deliveryInstructions,
      })
      return NextResponse.json(
        { success: false, error: 'Missing required fields (items, shippingInfo, customerId, email, deliveryInstructions)' },
        { status: 400 }
      )
    }

    // Generate unique order ID
    const orderId = uuidv4()

    // Group items by vendor
    const vendorOrders = new Map()
    
    for (const item of items) {
      const vendorId = item.vendorId
      // Try to get storeId from item, fallback to product lookup if missing
      let storeId = item.storeId
      if (!storeId && item.productId) {
        // Fetch product to get storeId
        try {
          const productRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/database/products/${item.productId}`)
          if (productRes.ok) {
            const productJson = await productRes.json();
            if (productJson.success && productJson.data && productJson.data.storeId) {
              storeId = productJson.data.storeId;
            }
          }
        } catch {}
      }
      if (!vendorOrders.has(vendorId)) {
        vendorOrders.set(vendorId, {
          vendorId,
          vendorName: item.vendorName,
          storeId,
          items: [],
          total: 0
        })
      }
      const vendor = vendorOrders.get(vendorId)
      vendor.items.push({ ...item, storeId })
      vendor.total += item.price * item.quantity
    }

    const subtotal = (Array.isArray(items) ? items : []).reduce((sum: number, item: any) => {
      return sum + (Number(item?.price || 0) * Number(item?.quantity || 0))
    }, 0)
    const vat = Math.round(subtotal * 0.07)

    const vendorIdList = Array.from(vendorOrders.keys()).map((id) => String(id || '')).filter(Boolean)
    const storeIdList = Array.from(vendorOrders.values()).map((v: any) => String(v?.storeId || '')).filter(Boolean)

    const storeQueryOr: any[] = []
    if (storeIdList.length > 0) storeQueryOr.push({ _id: { $in: storeIdList } })
    if (vendorIdList.length > 0) storeQueryOr.push({ vendorId: { $in: vendorIdList } })

    let stores: any[] = []
    if (storeQueryOr.length > 0) {
      stores = await Store.find({ $or: storeQueryOr }).lean()
    }

    const storeById = new Map<string, any>()
    const storeByVendorId = new Map<string, any>()
    for (const store of stores || []) {
      storeById.set(String(store?._id || ''), store)
      if (store?.vendorId && !storeByVendorId.has(String(store.vendorId))) {
        storeByVendorId.set(String(store.vendorId), store)
      }
    }

    const dropoffAddress = [
      shippingInfo.address,
      shippingInfo.city,
      shippingInfo.state,
      shippingInfo.country,
    ].filter(Boolean).join(', ')

    let shipping = 0
    let hasTbdShipping = false

    for (const vendor of vendorOrders.values() as any[]) {
      const store = storeById.get(String(vendor?.storeId || '')) || storeByVendorId.get(String(vendor?.vendorId || ''))
      const pickupAddress = String(store?.address || '')
      const shippingFee = estimateShippingFee({
        pickupAddress,
        dropoffAddress,
        dropoffState: String(shippingInfo?.state || ''),
      })

      vendor.storeId = vendor.storeId || store?._id?.toString?.() || ''
      vendor.storeAddress = pickupAddress || ''
      vendor.shippingFee = shippingFee
      vendor.shippingFeeLabel = shippingFee == null ? 'TBD' : `NGN ${Number(shippingFee).toLocaleString('en-NG')}`

      if (typeof shippingFee === 'number') {
        shipping += shippingFee
      } else {
        hasTbdShipping = true
      }
    }

    const computedTotalAmount = subtotal + vat + shipping

    // Create order record in database
    // Collect all unique storeIds from vendorOrders
    const storeIds = Array.from(vendorOrders.values()).map(v => v.storeId).filter(Boolean)
    const orderData = {
      orderId,
      customerId,
      items,
      shippingInfo,
      shippingAddress: {
        street: shippingInfo.address,
        city: shippingInfo.city,
        state: shippingInfo.state,
        zipCode: shippingInfo.zipCode,
        country: shippingInfo.country,
        instructions: shippingInfo.deliveryInstructions,
      },
      paymentMethod,
      subtotal,
      vat,
      shipping,
      hasTbdShipping,
      totalAmount: computedTotalAmount,
      status: 'pending_payment',
      paymentStatus: 'pending',
      vendors: Array.from(vendorOrders.values()),
      storeIds,
      createdAt: new Date()
    }

    console.log('Creating order with data:', orderData)
    const order = await createOrder(orderData)
    console.log('Order created successfully:', order)

    // Initialize payment with Paystack
    if (paymentMethod === 'paystack') {
      const paystackAmounts = calculatePaystackCheckoutAmounts(Number(computedTotalAmount))
      if (paystackAmounts.payableAmount <= 0) {
        return NextResponse.json(
          { success: false, error: 'Invalid order amount for payment initialization' },
          { status: 400 }
        )
      }

      console.log('Initializing Paystack payment with data:', {
        email: shippingInfo.email,
        amount: paystackAmounts.payableAmount,
        orderId,
        customerId,
        itemCount: items.length
      })

      const paymentResult = await paystackService.initializePayment({
        email: shippingInfo.email,
        amount: paystackAmounts.payableAmount,
        orderId,
        customerId,
        items: [
          ...items,
          {
            productId: 'paystack-processing-charge',
            title: 'Paystack Processing Charge',
            quantity: 1,
            price: paystackAmounts.chargeAmount,
            vendorId: 'system',
            vendorName: 'Make It Sell',
          },
        ]
      })

      console.log('Paystack result:', paymentResult)
      if (!paymentResult.success) {
        console.error('Full Paystack error response:', paymentResult)
      }

      if (paymentResult.success) {
        const response = {
          success: true,
          orderId,
          authorization_url: paymentResult.authUrl,
          reference: paymentResult.data?.reference,
          orderAmount: paystackAmounts.orderAmount,
          paystackChargeAmount: paystackAmounts.chargeAmount,
          payableAmount: paystackAmounts.payableAmount,
        }
        console.log('API returning successful response:', response)
        return NextResponse.json(response)
      }

      return NextResponse.json(
        { success: false, error: paymentResult.message || 'Payment initialization failed', paystack: paymentResult },
        { status: 400 }
      )
    }

    // Initialize payment with Xoro Pay
    if (paymentMethod === 'xoro_pay') {
      console.log('Initializing Xoro Pay payment with data:', {
        email: shippingInfo.email,
        amount: computedTotalAmount,
        orderId,
        customerId,
        itemCount: items.length
      })
      
      const paymentReference = `${orderId}-${Date.now()}`
      const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.makeitsell.org'}/api/payments/verify`

      const paymentResult = await xoroPayService.initializePayment({
        email: shippingInfo.email,
        amount: computedTotalAmount,
        reference: paymentReference,
        callbackUrl,
        metadata: {
          orderId,
          customerId,
          items,
          subtotal,
          vat,
          shipping,
          hasTbdShipping,
          totalAmount: computedTotalAmount,
          type: 'order',
        },
      })

      console.log('Xoro Pay result:', paymentResult)
      if (!paymentResult.success) {
        console.error('Full Xoro Pay error response:', paymentResult)
      }

      if (paymentResult.success) {
        const response = {
          success: true,
          orderId,
          authorization_url: paymentResult.authorizationUrl,
          reference: paymentResult.reference || paymentReference,
        }
        console.log('API returning successful response:', response)
        return NextResponse.json(response)
      }

      return NextResponse.json(
        { success: false, error: paymentResult.message || 'Payment initialization failed', xoroPay: paymentResult },
        { status: 400 }
      )
    }

    if (paymentMethod === 'wallet') {
      console.log('[WALLET] Processing wallet payment for order:', orderId)
      console.log('[WALLET] Customer ID:', customerId)
      console.log('[WALLET] Total amount:', computedTotalAmount)
      
      const normalizedAmount = Math.round(Number(computedTotalAmount) * 100) / 100
      if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        console.error('[WALLET] Invalid amount:', normalizedAmount)
        return NextResponse.json({ success: false, error: 'Invalid total amount' }, { status: 400 })
      }

      console.log('[WALLET] Normalized amount:', normalizedAmount)

      await connectToDatabase()
      console.log('[WALLET] Database connected')

      // Check current wallet balance first
      const currentUser = await User.findOne({ _id: customerId, role: 'customer' })
      console.log('[WALLET] Current user found:', !!currentUser)
      console.log('[WALLET] Current wallet balance:', currentUser?.walletBalance)

      if (!currentUser) {
        console.error('[WALLET] User not found:', customerId)
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        )
      }

      if (typeof currentUser.walletBalance !== 'number' || currentUser.walletBalance < normalizedAmount) {
        console.error('[WALLET] Insufficient balance. Required:', normalizedAmount, 'Available:', currentUser.walletBalance)
        return NextResponse.json(
          { success: false, error: `Insufficient wallet balance. You have ₦${currentUser.walletBalance.toFixed(2)} but need ₦${normalizedAmount.toFixed(2)}` },
          { status: 400 }
        )
      }

      const walletDebitResult = await User.updateOne(
        {
          _id: customerId,
          role: 'customer',
          walletBalance: { $gte: normalizedAmount },
        },
        {
          $inc: { walletBalance: -normalizedAmount },
          $set: { updatedAt: new Date() },
        }
      )

      console.log('[WALLET] Debit result:', { 
        matchedCount: walletDebitResult.matchedCount, 
        modifiedCount: walletDebitResult.modifiedCount 
      })

      if (walletDebitResult.modifiedCount === 0) {
        console.error('[WALLET] Failed to debit wallet - race condition or balance changed')
        return NextResponse.json(
          { success: false, error: 'Failed to debit wallet. Please try again.' },
          { status: 400 }
        )
      }

      console.log('[WALLET] Wallet debited successfully')
      console.log('[WALLET] Wallet debited successfully')

      const walletPaymentReference = `wallet_order_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`
      console.log('[WALLET] Creating transaction with reference:', walletPaymentReference)

      await WalletTransaction.create({
        userId: String(customerId),
        type: 'purchase_debit',
        amount: normalizedAmount,
        status: 'completed',
        reference: walletPaymentReference,
        paymentReference: walletPaymentReference,
        provider: 'wallet',
        note: `Wallet payment for order ${orderId}`,
        metadata: {
          source: 'wallet_checkout',
          orderId,
          debit: true,
        },
        orderId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      console.log('[WALLET] Transaction created')

      await updateOrder(orderId, {
        status: 'confirmed',
        paymentStatus: 'completed',
        paymentReference: walletPaymentReference,
        paymentData: {
          provider: 'wallet',
          reference: walletPaymentReference,
        },
        paidAt: new Date(),
      })

      console.log('[WALLET] Order updated to confirmed')

      const vendorCreditResult = await creditVendorWalletsForOrder(orderId, {
        paymentReference: walletPaymentReference,
      })

      console.log('[WALLET] Vendor credit summary:', vendorCreditResult)

      return NextResponse.json({
        success: true,
        orderId,
        paymentMethod: 'wallet',
        reference: walletPaymentReference,
        message: 'Order paid successfully with wallet',
      })
    }

    // For other payment methods (can be extended)
    return NextResponse.json({
      success: true,
      orderId,
      message: 'Order created successfully'
    })

  } catch (error) {
    console.error('[PAYMENT INIT] Payment initialization error:', error)
    console.error('[PAYMENT INIT] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    })
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to initialize payment' },
      { status: 500 }
    )
  }
}