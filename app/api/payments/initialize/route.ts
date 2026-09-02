import { NextRequest, NextResponse } from 'next/server'
import { paystackService } from '@/lib/payment'
import { getOrderById, updateOrder } from '@/lib/mongodb-operations'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import crypto from 'crypto'
import { calculatePaystackCheckoutAmounts } from '@/lib/paystack-charges'
import { getCanonicalAppBaseUrl } from '@/lib/app-url'
import { sendOrderPlacementNotifications } from '@/lib/order-notifications'
import { Product } from '@/lib/models/Product'
import { maybeSendLowStockAlert } from '@/lib/stock-alerts'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { createShipmentsForOrder } from '@/lib/order-dispatch'
import { notifyVendorsNewOrder } from '@/lib/whatsapp/notifications'
import { buildOrder } from '@/lib/order-creation'

async function deductStock(orderId: string) {
  try {
    const order = await getOrderById(orderId)
    if (!order) return
    const allItems = (order as any).vendors?.flatMap((v: any) => v.items || []) || []
    for (const item of allItems) {
      if (!item.productId || !item.quantity) continue
      const current = await Product.findOne({ _id: item.productId }).lean() as any
      if (!current) continue
      const qty = Math.abs(item.quantity)

      // Every completed sale counts toward `sales` regardless of the stock/9999-sentinel
      // branches below — this mirrors the Paystack path (app/api/payments/verify/route.ts),
      // which already did this correctly. This wallet path never incremented sales at all,
      // which is why every product showed 0 sales despite real completed wallet-paid orders.
      await Product.updateOne({ _id: item.productId }, { $inc: { sales: qty } })

      if (current.stock === 9999) continue
      const oldStock = current.stock || 0
      const deduction = Math.min(qty, oldStock)
      if (deduction > 0) {
        await Product.updateOne({ _id: item.productId }, { $inc: { stock: -deduction } })
        const newStock = oldStock - deduction
        if (newStock <= 0) await Product.updateOne({ _id: item.productId }, { $set: { status: 'out_of_stock' } })
        void maybeSendLowStockAlert(current, oldStock, newStock)
      }
    }
  } catch (err) {
    console.error('[deductStock]', err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    console.log('Payment API received:', body)

    const { items, shippingInfo, paymentMethod, courierSelections } = body

    // Always the caller's own session — never trust customerId from the body. This
    // matters most on the wallet path below, which debits customerId's balance directly
    // with no external payment-gateway confirmation step; an unvalidated body value there
    // would let anyone drain any wallet by placing an order "paid" from someone else's ID.
    const customerId = sessionUser.id

    const normalizedPaymentMethod = (paymentMethod === 'checkout') ? 'paystack' : paymentMethod

    const buildResult = await buildOrder({
      customerId,
      items,
      shippingInfo,
      paymentMethod: normalizedPaymentMethod,
      courierSelections,
    })

    if (!buildResult.success) {
      return NextResponse.json({ success: false, error: buildResult.error }, { status: buildResult.status })
    }

    const { orderId, totalAmount: computedTotalAmount } = buildResult

    // Initialize payment with Paystack
    if (normalizedPaymentMethod === 'paystack') {
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

    if (normalizedPaymentMethod === 'bach') {
      const { bachService } = await import('@/lib/bach')
      const appBaseUrl = getCanonicalAppBaseUrl()
      const returnUrl = `${appBaseUrl}/api/payments/bach-callback`

      const bachResult = await bachService.initializeCheckout({
        amount: computedTotalAmount,
        email: shippingInfo.email,
        name: `${String(shippingInfo.firstName || '').trim()} ${String(shippingInfo.lastName || '').trim()}`.trim() || shippingInfo.email,
        phoneNumber: shippingInfo.phone,
        orderId,
        customerId,
        returnUrl,
      })

      if (bachResult.success) {
        return NextResponse.json({
          success: true,
          orderId,
          authorization_url: bachResult.checkoutUrl,
          checkoutId: bachResult.checkoutId,
        })
      }

      return NextResponse.json(
        { success: false, error: bachResult.error || 'Bach payment initialization failed' },
        { status: 400 }
      )
    }

    if (normalizedPaymentMethod === 'wallet') {
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
      const currentUser = await User.findOne({ _id: customerId })
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
        paymentStatus: 'escrow',
        paymentReference: walletPaymentReference,
        paymentData: {
          provider: 'wallet',
          reference: walletPaymentReference,
        },
        paidAt: new Date(),
      })

      console.log('[WALLET] Order updated to confirmed')
      await deductStock(orderId)
      await createShipmentsForOrder(orderId).catch((err) => console.error('[WALLET] Shipbubble dispatch failed:', err))
      notifyVendorsNewOrder(orderId)

      const paidOrder = await getOrderById(orderId)
      if (paidOrder) {
        await sendOrderPlacementNotifications(orderId, paidOrder)
      }

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
