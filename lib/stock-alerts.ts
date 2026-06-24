import { emailService } from './email'
import { connectToDatabase } from './mongodb'
import { ObjectId } from 'mongodb'

const LOW_STOCK_THRESHOLD = 3
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.makeitsell.ng'

/**
 * Send a low-stock alert email to the vendor.
 * Only fires when stock CROSSES the threshold from above — no retroactive alerts
 * for products that were already low when this feature launched.
 */
export async function maybeSendLowStockAlert(
  product: { _id?: any; id?: string; title?: string; name?: string; vendorId?: any },
  oldStock: number,
  newStock: number
) {
  if (
    oldStock <= LOW_STOCK_THRESHOLD ||  // was already low — no alert
    newStock > LOW_STOCK_THRESHOLD ||   // still above threshold — no alert
    newStock <= 0                        // out of stock handled separately
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
    if (!vendor?.email) return

    const productUrl = `${SITE_URL}/products/${productId}`
    const stockWord = newStock === 1 ? 'unit' : 'units'
    const vendorName = vendor.name || 'there'

    await emailService.sendEmail({
      to: vendor.email,
      subject: `Low Stock Alert — ${productTitle} has ${newStock} ${stockWord} left`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
          <div style="background:#3d1218;padding:20px 28px;display:flex;align-items:center;gap:12px">
            <img src="${SITE_URL}/images/logo2.png" alt="MakeItSell" style="height:36px;display:block" />
            <div style="width:3px;height:36px;background:#dc2626;border-radius:2px"></div>
            <div style="color:#fca5a5;font-size:11px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase">Stock Alert</div>
          </div>
          <div style="padding:28px">
            <p style="color:#374151;margin:0 0 6px 0;font-size:15px">Hi ${vendorName},</p>
            <p style="color:#6b7280;margin:0 0 24px 0;font-size:14px;line-height:1.6">One of your products is running critically low on stock. Restock soon to keep sales flowing.</p>
            <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:18px 20px;margin-bottom:24px">
              <p style="margin:0 0 4px 0;font-weight:600;color:#1f2937;font-size:15px">${productTitle}</p>
              <p style="margin:0;color:#dc2626;font-size:14px;font-weight:500">Only <strong>${newStock} ${stockWord}</strong> remaining</p>
            </div>
            <a href="${productUrl}" style="display:inline-block;background:#3d1218;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">View &amp; Update Product</a>
          </div>
          <div style="background:#f9fafb;padding:14px 28px;text-align:center;font-size:12px;color:#9ca3af;border-top:1px solid #f3f4f6">
            MakeItSell &mdash; Nigeria&apos;s Smart Marketplace &mdash; makeitsell.ng
          </div>
        </div>
      `,
      text: `Low Stock Alert: "${productTitle}" has only ${newStock} ${stockWord} left. Update it at: ${productUrl}`,
    })
    console.log(`[stock-alert] Sent low-stock alert for "${productTitle}" (${newStock} left) to ${vendor.email}`)
  } catch (err) {
    console.error('[stock-alert] Failed to send low-stock alert:', err)
  }
}
