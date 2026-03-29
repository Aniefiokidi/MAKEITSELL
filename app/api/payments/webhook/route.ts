import { NextRequest, NextResponse } from 'next/server'
import { paystackService } from '@/lib/payment'
import { xoroPayService } from '@/lib/xoro-pay'
import { emailService } from '@/lib/email'
import { updateOrder, getOrderById, creditVendorWalletsForOrder } from '@/lib/mongodb-operations'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { User } from '@/lib/models/User'
import { connectToDatabase } from '@/lib/mongodb'
import mongoose from 'mongoose'

const pickFirstString = (source: any, keys: string[]) => {
  for (const key of keys) {
    const value = source?.[key]
    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }
  return ''
}

const asObject = (value: any) => (value && typeof value === 'object' ? value : {})

const safeParseJson = (value: any) => {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

const hasWalletTopupMarker = (data: any) => {
  const metadata = asObject(data?.metadata)
  const metadataItemsRaw = metadata?.items
  const metadataItems = safeParseJson(metadataItemsRaw)

  const hasWalletTopupItem = Array.isArray(metadataItems)
    && metadataItems.some((item: any) => item?.productId === 'wallet-topup' || item?.productId === 'vendor-wallet-topup')

  const metadataType = String(metadata?.type || '').toLowerCase()
  const ref = String(data?.reference || '').toLowerCase()
  const orderId = String(metadata?.orderId || metadata?.orderID || '').toLowerCase()

  return hasWalletTopupItem
    || metadataType === 'wallet_topup'
    || metadataType === 'vendor_wallet_topup'
    || ref.startsWith('wallet_topup_')
    || ref.startsWith('vendor_wallet_topup_')
    || orderId.startsWith('wallet_topup_')
    || orderId.startsWith('vendor_wallet_topup_')
}

const normalizeToPaystackLikePayload = (payload: any) => {
  const root = asObject(payload)
  const data = asObject(root.data || root.result || root.payload || root)
  const metadata = asObject(data.metadata || root.metadata)

  const reference = pickFirstString(data, [
    'reference',
    'payment_reference',
    'paymentReference',
    'tx_ref',
    'trxref',
    'transaction_reference',
    'transactionReference',
    'id',
  ]) || pickFirstString(root, [
    'reference',
    'payment_reference',
    'paymentReference',
    'tx_ref',
    'trxref',
    'transaction_reference',
    'transactionReference',
    'id',
  ])

  return {
    reference,
    metadata,
    amount: data.amount,
    currency: data.currency,
    status: pickFirstString(data, ['status', 'payment_status', 'paymentStatus']) || pickFirstString(root, ['status', 'payment_status', 'paymentStatus']),
    raw: root,
  }
}

const isXoroSuccessEvent = (event: string) => {
  const normalized = event.toLowerCase()
  return [
    'charge.success',
    'payment.success',
    'payment.completed',
    'transaction.success',
    'transaction.completed',
    'checkout.success',
  ].includes(normalized)
}

const isXoroFailureEvent = (event: string) => {
  const normalized = event.toLowerCase()
  return [
    'charge.failed',
    'payment.failed',
    'transaction.failed',
    'checkout.failed',
  ].includes(normalized)
}

const isXoroTransferSuccessEvent = (event: string) => {
  return ['transfer.success', 'payout.success', 'payout.completed'].includes(event.toLowerCase())
}

const isXoroTransferFailureEvent = (event: string) => {
  return ['transfer.failed', 'transfer.reversed', 'payout.failed', 'payout.reversed'].includes(event.toLowerCase())
}

async function handleXoroWebhook(payload: any) {
  const event = pickFirstString(payload, ['event', 'type', 'name', 'action']).toLowerCase()
  const normalizedData = normalizeToPaystackLikePayload(payload)

  if (!event) {
    const status = String(normalizedData.status || '').toLowerCase()
    if (status === 'success' || status === 'successful' || status === 'completed' || status === 'paid') {
      await handleSuccessfulPayment(normalizedData)
      return
    }
    if (status === 'failed' || status === 'abandoned' || status === 'cancelled' || status === 'canceled') {
      await handleFailedPayment(normalizedData)
      return
    }
    return
  }

  if (isXoroSuccessEvent(event)) {
    await handleSuccessfulPayment(normalizedData)
    return
  }

  if (isXoroFailureEvent(event)) {
    await handleFailedPayment(normalizedData)
    return
  }

  if (isXoroTransferSuccessEvent(event)) {
    await handleTransferSuccess(normalizedData)
    return
  }

  if (isXoroTransferFailureEvent(event)) {
    await handleTransferFailure(normalizedData)
    return
  }
}

const maybeHandleUnsignedXoroWebhook = async (payload: any) => {
  const event = pickFirstString(payload, ['event', 'type', 'name', 'action']).toLowerCase()
  const normalizedData = normalizeToPaystackLikePayload(payload)
  const metadata = asObject(normalizedData.metadata)

  const referenceCandidates = Array.from(
    new Set(
      [
        normalizedData.reference,
        pickFirstString(asObject(payload?.data), ['reference', 'payment_reference', 'paymentReference', 'tx_ref', 'trxref', 'id']),
        pickFirstString(payload, ['reference', 'payment_reference', 'paymentReference', 'tx_ref', 'trxref', 'id']),
        String(metadata?.orderId || ''),
        String(metadata?.orderID || ''),
      ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    )
  )

  if (referenceCandidates.length === 0) {
    return false
  }

  const successLikeEvent = !event || isXoroSuccessEvent(event)
  const failureLikeEvent = Boolean(event) && isXoroFailureEvent(event)

  if (!successLikeEvent && !failureLikeEvent) {
    return false
  }

  if (failureLikeEvent) {
    await handleFailedPayment(normalizedData)
    return true
  }

  for (const reference of referenceCandidates) {
    try {
      const verify = await xoroPayService.verifyPayment(reference)
      if (!verify.success) {
        continue
      }

      const verifiedData = {
        ...normalizedData,
        reference: verify.reference || normalizedData.reference || reference,
        metadata: {
          ...metadata,
          ...(verify.metadata || {}),
        },
      }

      await handleSuccessfulPayment(verifiedData)
      return true
    } catch {
      // Continue with other candidate references.
    }
  }

  return false
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const payload = JSON.parse(body)

    const paystackSignature = request.headers.get('x-paystack-signature') || ''
    const xoroSignature = request.headers.get('x-xoro-signature')
      || request.headers.get('x-signature')
      || request.headers.get('xoropay-signature')
      || ''

    if (paystackSignature) {
      const isValidPaystack = paystackService.verifyWebhook(payload, paystackSignature)
      if (!isValidPaystack) {
        console.error('Invalid Paystack webhook signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
      }

      const { event, data } = payload

      switch (event) {
        case 'charge.success':
          await handleSuccessfulPayment(data)
          break

        case 'charge.failed':
          await handleFailedPayment(data)
          break

        case 'charge.dispute':
          await handleDispute(data)
          break

        case 'transfer.success':
          await handleTransferSuccess(data)
          break

        case 'transfer.failed':
          await handleTransferFailure(data)
          break

        case 'transfer.reversed':
          await handleTransferFailure(data)
          break

        default:
          console.log(`Unhandled webhook event: ${event}`)
      }

      return NextResponse.json({ success: true })
    }

    if (xoroSignature) {
      const isValidXoro = xoroPayService.verifyWebhook(body, xoroSignature)
      if (!isValidXoro) {
        console.error('Invalid Xoro webhook signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
      }

      await handleXoroWebhook(payload)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Missing webhook signature' }, { status: 400 })

  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

async function handleSuccessfulPayment(data: any) {
  try {
    const hasWalletTopupItem = hasWalletTopupMarker(data)

    if (hasWalletTopupItem) {
      await connectToDatabase()

      const paymentReference = data?.reference || data?.metadata?.paymentReference || data?.metadata?.payment_reference
      const orderIdFromMeta = data?.metadata?.orderId || data?.metadata?.orderID
      const referenceCandidates = Array.from(
        new Set(
          [
            paymentReference,
            orderIdFromMeta,
            data?.metadata?.transaction_reference,
            data?.metadata?.transactionReference,
          ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        )
      )

      if (referenceCandidates.length === 0) {
        console.error('Wallet top-up verification skipped due to missing reference in webhook payload')
        return
      }

      const transaction = await WalletTransaction.findOne({
        type: 'topup',
        $or: [
          { paymentReference: { $in: referenceCandidates } },
          { reference: { $in: referenceCandidates } },
        ],
      })

      if (!transaction) {
        console.error('Wallet top-up transaction not found for webhook references:', referenceCandidates)
        return
      }

      let verifiedPaymentReference = paymentReference || transaction.paymentReference || transaction.reference
      let verifiedPaymentData = data
      const provider = String(transaction.provider || '').toLowerCase()

      if (provider.includes('xoro')) {
        const verificationCandidates = Array.from(
          new Set(
            [
              ...referenceCandidates,
              transaction.paymentReference,
              transaction.reference,
              transaction?.metadata?.orderId,
              transaction?.metadata?.orderID,
            ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          )
        )

        let verificationResult: Awaited<ReturnType<typeof xoroPayService.verifyPayment>> | null = null
        for (const candidate of verificationCandidates) {
          try {
            const attempt = await xoroPayService.verifyPayment(candidate)
            if (attempt.success) {
              verificationResult = attempt
              break
            }
            if (!verificationResult) {
              verificationResult = attempt
            }
          } catch {
            // Continue trying other candidate references.
          }
        }

        if (!verificationResult?.success) {
          console.warn('Wallet top-up verify endpoint did not confirm success; falling back to signed webhook payload', {
            references: verificationCandidates,
          })
          verifiedPaymentReference = verifiedPaymentReference || referenceCandidates[0]
          verifiedPaymentData = {
            ...(asObject(data) || {}),
            _verifyFallback: true,
          }
        } else {
          verifiedPaymentReference = verificationResult.reference || verifiedPaymentReference
          verifiedPaymentData = verificationResult.raw || data
        }
      }

      const completeUpdate = await WalletTransaction.updateOne(
        { _id: transaction._id, status: 'pending' },
        {
          $set: {
            status: 'completed',
            paymentReference: verifiedPaymentReference,
            metadata: {
              ...(transaction.metadata || {}),
              xoroPayData: verifiedPaymentData,
            },
            updatedAt: new Date(),
          },
        }
      )

      if (completeUpdate.modifiedCount > 0) {
        const userIdObject = mongoose.Types.ObjectId.isValid(transaction.userId)
          ? new mongoose.Types.ObjectId(transaction.userId)
          : transaction.userId

        await User.updateOne(
          { _id: userIdObject },
          {
            $inc: { walletBalance: transaction.amount },
            $set: { updatedAt: new Date() },
          }
        )
      }

      console.log(`Wallet top-up successful: ${verifiedPaymentReference}`)
      return
    }

    const orderId = data.metadata?.orderId
    
    if (!orderId) {
      console.error('Order ID not found in webhook data')
      return
    }

    // Update order status
    await updateOrder(orderId, {
      status: 'confirmed',
      paymentStatus: 'completed',
      paymentReference: data.reference,
      paymentData: data,
      paidAt: new Date()
    })

    await creditVendorWalletsForOrder(orderId, { paymentReference: data.reference })

    // Get order details for email notifications
    const order = await getOrderById(orderId)
    
    if (order) {
      // Send confirmation emails to customer and vendors
      for (const vendor of order.vendors) {
        await emailService.sendOrderConfirmationEmails({
          customerEmail: order.shippingInfo.email,
          vendorEmail: vendor.vendorEmail || 'vendor@example.com',
          orderId,
          customerName: `${order.shippingInfo.firstName} ${order.shippingInfo.lastName}`,
          vendorName: vendor.vendorName,
          items: vendor.items,
          total: vendor.total,
          shippingAddress: order.shippingInfo
        })
      }
    }

    console.log(`Payment successful for order: ${orderId}`)
  } catch (error) {
    console.error('Error handling successful payment:', error)
  }
}

async function handleFailedPayment(data: any) {
  try {
    const hasWalletTopupItem = hasWalletTopupMarker(data)

    if (hasWalletTopupItem) {
      await connectToDatabase()

      const paymentReference = data?.reference
      const orderIdFromMeta = data?.metadata?.orderId || data?.metadata?.orderID

      await WalletTransaction.updateOne(
        {
          type: 'topup',
          status: 'pending',
          $or: [
            { paymentReference },
            { reference: orderIdFromMeta },
          ],
        },
        {
          $set: {
            status: 'failed',
            paymentReference,
            metadata: {
              paystackData: data,
            },
            updatedAt: new Date(),
          },
        }
      )

      console.log(`Wallet top-up failed: ${paymentReference}`)
      return
    }

    const orderId = data.metadata?.orderId
    
    if (!orderId) {
      console.error('Order ID not found in webhook data')
      return
    }

    // Update order status
    await updateOrder(orderId, {
      status: 'cancelled',
      paymentStatus: 'failed',
      paymentReference: data.reference,
      paymentData: data,
      cancelledAt: new Date()
    })

    console.log(`Payment failed for order: ${orderId}`)
  } catch (error) {
    console.error('Error handling failed payment:', error)
  }
}

async function handleDispute(data: any) {
  try {
    const orderId = data.metadata?.orderId
    
    if (!orderId) {
      console.error('Order ID not found in dispute data')
      return
    }

    // Update order with dispute information
    await updateOrder(orderId, {
      disputeStatus: 'active',
      disputeData: data,
      disputeAt: new Date()
    })

    // Notify administrators about the dispute
    // You can implement admin notification logic here

    console.log(`Payment dispute for order: ${orderId}`)
  } catch (error) {
    console.error('Error handling payment dispute:', error)
  }
}

async function handleTransferSuccess(data: any) {
  try {
    const reference = data?.reference
    if (!reference) {
      return
    }

    await connectToDatabase()

    const transaction = await WalletTransaction.findOne({
      type: 'withdrawal',
      $or: [
        { reference },
        { 'metadata.payoutReference': reference },
      ],
    })

    if (!transaction) {
      return
    }

    await WalletTransaction.updateOne(
      {
        _id: transaction._id,
      },
      {
        $set: {
          status: 'completed',
          metadata: {
            ...(transaction.metadata || {}),
            transferData: data,
          },
          updatedAt: new Date(),
        },
      }
    )
  } catch (error) {
    console.error('Error handling transfer success:', error)
  }
}

async function handleTransferFailure(data: any) {
  try {
    const reference = data?.reference
    if (!reference) {
      return
    }

    await connectToDatabase()

    const transaction = await WalletTransaction.findOne({
      type: 'withdrawal',
      $or: [
        { reference },
        { 'metadata.payoutReference': reference },
      ],
    })

    if (!transaction) {
      return
    }

    const failedUpdate = await WalletTransaction.updateOne(
      {
        _id: transaction._id,
        status: { $ne: 'failed' },
      },
      {
        $set: {
          status: 'failed',
          metadata: {
            ...(transaction.metadata || {}),
            transferData: data,
          },
          updatedAt: new Date(),
        },
      }
    )

    if (failedUpdate.modifiedCount > 0) {
      const userIdObject = mongoose.Types.ObjectId.isValid(transaction.userId)
        ? new mongoose.Types.ObjectId(transaction.userId)
        : transaction.userId

      await User.updateOne(
        { _id: userIdObject },
        {
          $inc: { walletBalance: transaction.amount },
          $set: { updatedAt: new Date() },
        }
      )
    }
  } catch (error) {
    console.error('Error handling transfer failure:', error)
  }
}