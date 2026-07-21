import { emailService } from './email'
import { connectToDatabase } from './mongodb'
import { pushToUser } from './push-notifications'
import { ObjectId } from 'mongodb'

const DEFAULT_LOW_STOCK_THRESHOLD = 3
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.makeitsell.ng'
const LOGO_URL = 'https://res.cloudinary.com/dgqxt06km/image/upload/q_auto/f_auto/v1778221830/logo_2_ovdgjg.png'

/**
 * Send a low-stock alert (email + push) to the vendor, once stock CROSSES their
 * per-product threshold from above — no retroactive alerts for products that were
 * already low when this feature launched, and no repeat alerts on every sale after.
 */
export async function maybeSendLowStockAlert(
  product: { _id?: any; id?: string; title?: string; name?: string; vendorId?: any; lowStockThreshold?: number },
  oldStock: number,
  newStock: number
) {
  const threshold = Number.isFinite(Number(product.lowStockThreshold)) && Number(product.lowStockThreshold) >= 0
    ? Number(product.lowStockThreshold)
    : DEFAULT_LOW_STOCK_THRESHOLD

  if (
    oldStock <= threshold ||  // was already low — no alert
    newStock > threshold ||   // still above threshold — no alert
    newStock <= 0              // out of stock handled separately
  ) return

  const productId = String(product._id || product.id || '')
  const productTitle = product.title || product.name || 'Untitled product'

  try {
    const { db } = await connectToDatabase()
    const vendorId = product.vendorId
    if (!vendorId) return

    let vendorQuery: any
    try {
      vendorQuery = { _id: new ObjectId(String(vendorId)) }
    } catch {
      vendorQuery = { _id: vendorId }
    }

    const vendor = await db.collection('users').findOne(vendorQuery, {
      projection: { email: 1, name: 1 }
    })
    if (!vendor) return

    const productUrl = `${SITE_URL}/vendor/products/${productId}/edit`
    const stockWord = newStock === 1 ? 'unit' : 'units'
    const vendorName = vendor.name || 'there'

    if (vendor.email) {
      void emailService.sendEmail({
        to: vendor.email,
        subject: `Low Stock Alert — ${productTitle} has ${newStock} ${stockWord} left`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
            <div style="background: #ffffff; padding: 20px; text-align: center; border-bottom: 3px solid #7f1d1d;">
              <img src="${LOGO_URL}" alt="Make It Sell" style="height: 44px; width: auto; display: block; margin: 0 auto;" />
            </div>
            <div style="background: #7f1d1d; color: #fff; padding: 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 22px;">Low Stock Alert</h1>
              <p style="margin: 8px 0 0 0; opacity: 0.92;">Restock soon to keep sales flowing</p>
            </div>
            <div style="padding: 24px;">
              <p style="margin: 0 0 6px 0; color: #374151; font-size: 15px;">Hi ${vendorName},</p>
              <p style="margin: 0 0 20px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">One of your products just crossed the low-stock threshold you set.</p>
              <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 16px 18px; margin-bottom: 20px;">
                <p style="margin: 0 0 4px 0; font-weight: 600; color: #1f2937; font-size: 15px;">${productTitle}</p>
                <p style="margin: 0; color: #dc2626; font-size: 14px; font-weight: 500;">Only <strong>${newStock} ${stockWord}</strong> remaining (threshold: ${threshold})</p>
              </div>
              <a href="${productUrl}" style="display: inline-block; background: #7f1d1d; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 14px;">View &amp; Restock Product</a>
            </div>
          </div>
        `,
        text: `Low Stock Alert: "${productTitle}" has only ${newStock} ${stockWord} left (threshold: ${threshold}). Update it at: ${productUrl}`,
      })
    }

    void pushToUser(String(vendorId), {
      title: 'Low Stock Alert',
      body: `${productTitle} has only ${newStock} ${stockWord} left — restock soon.`,
      url: `/vendor/products/${productId}/edit`,
      tag: `low-stock-${productId}`,
    }).catch(() => {})

    console.log(`[stock-alert] Sent low-stock alert for "${productTitle}" (${newStock} left, threshold ${threshold}) to vendor ${vendorId}`)
  } catch (err) {
    console.error('[stock-alert] Failed to send low-stock alert:', err)
  }
}
