import { NextRequest, NextResponse } from 'next/server'
import { paystackService } from '@/lib/payment'
import { emailService } from '@/lib/email'
import { updateOrder, getOrderById, creditVendorWalletsForOrder } from '@/lib/mongodb-operations'
import { WalletTransaction } from '@/lib/models/WalletTransaction'
import { User } from '@/lib/models/User'
import { connectToDatabase } from '@/lib/mongodb'
import mongoose from 'mongoose'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-paystack-signature') || ''

    // Verify webhook signature
    const payload = JSON.parse(body)
    const isValid = paystackService.verifyWebhook(payload, signature)

    if (!isValid) {
      console.error('Invalid webhook signature')
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

  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

async function handleSuccessfulPayment(data: any) {
  try {
    const metadataItemsRaw = data?.metadata?.items
    const metadataItems = typeof metadataItemsRaw === 'string'
      ? JSON.parse(metadataItemsRaw)
      : metadataItemsRaw
    const hasWalletTopupItem = Array.isArray(metadataItems)
      && metadataItems.some((item: any) => item?.productId === 'wallet-topup' || item?.productId === 'vendor-wallet-topup')

    if (hasWalletTopupItem) {
      await connectToDatabase()

      const paymentReference = data?.reference
      const orderIdFromMeta = data?.metadata?.orderId || data?.metadata?.orderID

      const transaction = await WalletTransaction.findOne({
        type: 'topup',
        $or: [
          { paymentReference },
          { reference: orderIdFromMeta },
        ],
      })

      if (!transaction) {
        console.error('Wallet top-up transaction not found for webhook reference:', paymentReference)
        return
      }

      const completeUpdate = await WalletTransaction.updateOne(
        { _id: transaction._id, status: 'pending' },
        {
          $set: {
            status: 'completed',
            paymentReference,
            metadata: {
              ...(transaction.metadata || {}),
              paystackData: data,
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

      console.log(`Wallet top-up successful: ${paymentReference}`)
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
    const metadataItemsRaw = data?.metadata?.items
    const metadataItems = typeof metadataItemsRaw === 'string'
      ? JSON.parse(metadataItemsRaw)
      : metadataItemsRaw
    const hasWalletTopupItem = Array.isArray(metadataItems)
      && metadataItems.some((item: any) => item?.productId === 'wallet-topup' || item?.productId === 'vendor-wallet-topup')

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
      reference,
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
      reference,
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