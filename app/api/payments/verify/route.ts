import { NextRequest, NextResponse } from 'next/server'
import { paystackService } from '@/lib/payment'
import { emailService } from '@/lib/email'
import { updateOrder, getOrderById, getUserById, getStores } from '@/lib/mongodb-operations'
import connectToDatabase from '@/lib/mongodb'
import mongoose from 'mongoose'

export async function GET(request: NextRequest) {
  try {
    console.log('=== PAYMENT VERIFICATION STARTED ===')
    const { searchParams } = new URL(request.url)
    const reference = searchParams.get('reference')
    console.log('Payment reference:', reference)

    if (!reference) {
      console.log('ERROR: Missing reference')
      const errorUrl = new URL('/checkout', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
      errorUrl.searchParams.set('error', 'missing_reference')
      console.log('Redirecting to:', errorUrl.toString())
      return NextResponse.redirect(errorUrl.toString())
    }

    // Verify payment with Paystack
    const verificationResult = await paystackService.verifyPayment(reference)

    if (!verificationResult.success) {
      const errorUrl = new URL('/checkout', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
      errorUrl.searchParams.set('error', 'payment_failed')
      return NextResponse.redirect(errorUrl.toString())
    }

    const paymentData = verificationResult.data
    const orderId = paymentData.metadata.orderId

    // Get order details before updating
    const order = await getOrderById(orderId)

    // Update order status
    await updateOrder(orderId, {
      status: 'confirmed',
      paymentStatus: 'completed',
      paymentReference: reference,
      paymentData: paymentData,
      paidAt: new Date()
    })

    // Update product stock and sales (supports both top-level items and vendor items)
    if (order && (order.items || order.vendors)) {
      try {
        await connectToDatabase()
        const db = mongoose.connection.db

        if (db) {
          // Combine items from top-level and vendor-scoped arrays
          const items: any[] = [
            ...(Array.isArray(order.items) ? order.items : []),
            ...(Array.isArray(order.vendors)
              ? order.vendors.flatMap((v: any) => Array.isArray(v.items) ? v.items : [])
              : [])
          ]

          for (const item of items) {
            const qty = item.quantity || 1

            // Build filters to handle ObjectId and string identifiers
            const filters: any[] = []
            if (item.productId) {
              if (mongoose.Types.ObjectId.isValid(item.productId)) {
                filters.push({ _id: new mongoose.Types.ObjectId(item.productId) })
              }
              filters.push({ productId: item.productId })
              filters.push({ id: item.productId })
            }

            if (filters.length === 0) {
              console.warn('Skipping stock update; no valid productId on item', item)
              continue
            }

            const result = await db.collection('products').updateOne(
              { $or: filters },
              {
                $inc: {
                  stock: -qty,
                  sales: qty
                }
              }
            )

            console.log(`Updated product ${item.productId}: deducted ${qty} stock, added ${qty} sales; matched ${result?.matchedCount}`)
          }
          console.log('Product stock and sales updated successfully')
        }
      } catch (stockError) {
        console.error('Error updating product stock/sales:', stockError)
        // Continue anyway - order is confirmed even if stock update fails
      }
    }
    if (order) {
      // Get customer details
      const customer = await getUserById(order.customerId)
      
      // Get vendor details from store
      let vendorEmail = 'vendor@example.com'
      let vendorName = 'Vendor'
      
      if (order.vendors && order.vendors.length > 0) {
        const vendorId = order.vendors[0].vendorId
        try {
          const stores = await getStores({ vendorId })
          if (stores && stores.length > 0) {
            vendorEmail = stores[0].email || vendorEmail
            vendorName = stores[0].storeName || vendorName
          }
        } catch (error) {
          console.log('Could not fetch vendor store details:', error)
        }
      }
      
      console.log('Sending order confirmation emails...')
      
      // Send confirmation emails
      await emailService.sendOrderConfirmationEmails({
        customerEmail: order.shippingInfo.email,
        vendorEmail,
        orderId,
        customerName: `${order.shippingInfo.firstName} ${order.shippingInfo.lastName}`,
        vendorName,
        items: order.items,
        total: order.totalAmount,
        shippingAddress: order.shippingInfo
      })
    }

    // Redirect to order confirmation page with absolute URL
    const redirectUrl = new URL('/order-confirmation', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
    redirectUrl.searchParams.set('orderId', orderId)
    console.log('=== PAYMENT VERIFICATION SUCCESS ===')
    console.log('Order ID:', orderId)
    console.log('Redirect URL:', redirectUrl.toString())
    console.log('NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL)
    return NextResponse.redirect(redirectUrl.toString())

  } catch (error) {
    console.error('Payment verification error:', error)
    const errorUrl = new URL('/checkout', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
    errorUrl.searchParams.set('error', 'verification_failed')
    return NextResponse.redirect(errorUrl.toString())
  }
}

export async function POST(request: NextRequest) {
  try {
    const { reference } = await request.json()

    if (!reference) {
      return NextResponse.json(
        { error: 'Payment reference is required' },
        { status: 400 }
      )
    }

    // Verify payment with Paystack
    const verificationResult = await paystackService.verifyPayment(reference)

    if (verificationResult.success) {
      const paymentData = verificationResult.data
      const orderId = paymentData.metadata.orderId

      // Get order details before updating
      const order = await getOrderById(orderId)

      // Update order status
      await updateOrder(orderId, {
        status: 'confirmed',
        paymentStatus: 'completed',
        paymentReference: reference,
        paymentData: paymentData,
        paidAt: new Date()
      })

      // Update product stock and sales (supports both top-level items and vendor items)
      if (order && (order.items || order.vendors)) {
        try {
          await connectToDatabase()
          const db = mongoose.connection.db
          
          if (db) {
            // Combine items from top-level and vendor-scoped arrays
            const items: any[] = [
              ...(Array.isArray(order.items) ? order.items : []),
              ...(Array.isArray(order.vendors)
                ? order.vendors.flatMap((v: any) => Array.isArray(v.items) ? v.items : [])
                : [])
            ]

            for (const item of items) {
              const qty = item.quantity || 1

              // Build filters to handle ObjectId and string identifiers
              const filters: any[] = []
              if (item.productId) {
                if (mongoose.Types.ObjectId.isValid(item.productId)) {
                  filters.push({ _id: new mongoose.Types.ObjectId(item.productId) })
                }
                filters.push({ productId: item.productId })
                filters.push({ id: item.productId })
              }

              if (filters.length === 0) {
                console.warn('Skipping stock update; no valid productId on item', item)
                continue
              }

              const result = await db.collection('products').updateOne(
                { $or: filters },
                {
                  $inc: {
                    stock: -qty,
                    sales: qty
                  }
                }
              )

              console.log(`Updated product ${item.productId}: deducted ${qty} stock, added ${qty} sales; matched ${result?.matchedCount}`)
            }
            console.log('Product stock and sales updated successfully')
          }
        } catch (stockError) {
          console.error('Error updating product stock/sales:', stockError)
          // Continue anyway - order is confirmed even if stock update fails
        }
      }
      if (order) {
        // Get vendor details from store
        let vendorEmail = 'vendor@example.com'
        let vendorName = 'Vendor'
        
        if (order.vendors && order.vendors.length > 0) {
          const vendorId = order.vendors[0].vendorId
          try {
            const stores = await getStores({ vendorId })
            if (stores && stores.length > 0) {
              vendorEmail = stores[0].email || vendorEmail
              vendorName = stores[0].storeName || vendorName
            }
          } catch (error) {
            console.log('Could not fetch vendor store details:', error)
          }
        }
        
        console.log('Sending order confirmation emails...')
        
        // Send confirmation emails
        await emailService.sendOrderConfirmationEmails({
          customerEmail: order.shippingInfo.email,
          vendorEmail,
          orderId,
          customerName: `${order.shippingInfo.firstName} ${order.shippingInfo.lastName}`,
          vendorName,
          items: order.items,
          total: order.totalAmount,
          shippingAddress: order.shippingInfo
        })
      }

      return NextResponse.json({
        success: true,
        orderId,
        message: 'Payment verified successfully'
      })
    }

    return NextResponse.json(
      { error: verificationResult.message || 'Payment verification failed' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Payment verification error:', error)
    return NextResponse.json(
      { error: 'Payment verification failed' },
      { status: 500 }
    )
  }
}