import nodemailer from 'nodemailer'

interface EmailData {
  to: string
  subject: string
  html: string
  attachments?: any[]
}

interface OrderEmailData {
  customerEmail: string
  vendorEmail: string
  orderId: string
  customerName: string
  vendorName: string
  items: any[]
  total: number
  shippingAddress: any
  deliveryEstimate?: { min: number; max: number }
  orderDate?: Date
}

class EmailService {
  private transporter: nodemailer.Transporter

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  }

  private calculateDeliveryEstimate(): { min: number; max: number } {
    // Random delivery estimate between 1-5 days
    const min = Math.floor(Math.random() * 3) + 1 // 1-3 days
    const max = min + Math.floor(Math.random() * 3) + 1 // min + 1-3 days (ensuring max >= min)
    return { min: Math.min(min, 5), max: Math.min(max, 5) }
  }

  private formatDeliveryDate(days: number): string {
    const date = new Date()
    date.setDate(date.getDate() + days)
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  async sendEmail(emailData: EmailData): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: `"Gote Marketplace" <${process.env.SMTP_USER}>`,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        attachments: emailData.attachments,
      })
      
      console.log('Email sent successfully to:', emailData.to)
      return true
    } catch (error) {
      console.error('Email sending failed:', error)
      return false
    }
  }

  async sendOrderConfirmationEmails(orderData: OrderEmailData): Promise<boolean> {
    try {
      // Add delivery estimate if not provided
      if (!orderData.deliveryEstimate) {
        orderData.deliveryEstimate = this.calculateDeliveryEstimate()
      }
      
      // Add order date if not provided
      if (!orderData.orderDate) {
        orderData.orderDate = new Date()
      }
      
      // Send confirmation email to customer
      const customerEmailSent = await this.sendCustomerOrderConfirmation(orderData)
      
      // Send notification email to vendor
      const vendorEmailSent = await this.sendVendorOrderNotification(orderData)

      return customerEmailSent && vendorEmailSent
    } catch (error) {
      console.error('Failed to send order emails:', error)
      return false
    }
  }

  private async sendCustomerOrderConfirmation(orderData: OrderEmailData): Promise<boolean> {
    const itemsList = orderData.items.map(item => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px; text-align: left;">
          <img src="${item.images?.[0] || ''}" alt="${item.title}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">
        </td>
        <td style="padding: 12px; text-align: left;">
          <strong>${item.title}</strong><br>
          <small style="color: #666;">Qty: ${item.quantity}</small>
        </td>
        <td style="padding: 12px; text-align: right;">₦${(item.price * item.quantity).toLocaleString()}</td>
      </tr>
    `).join('')

    const customerEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #f8f9fa; padding: 20px; text-align: center;">
          <h1 style="color: #333; margin: 0;">Order Confirmation</h1>
          <p style="color: #666; margin: 5px 0;">Thank you for your order!</p>
        </div>
        
        <div style="padding: 20px; background: white;">
          <h2 style="color: #333;">Hi ${orderData.customerName},</h2>
          <p>We've received your order and it's being processed. Here are the details:</p>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #333;">Order #${orderData.orderId}</h3>
            <p style="margin: 0; color: #666;">Vendor: ${orderData.vendorName}</p>
          </div>
          
          <h3 style="color: #333;">Order Items</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="padding: 12px; text-align: left;">Product</th>
                <th style="padding: 12px; text-align: left;">Details</th>
                <th style="padding: 12px; text-align: right;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsList}
              <tr style="border-top: 2px solid #333; font-weight: bold;">
                <td colspan="2" style="padding: 15px; text-align: right;">Total:</td>
                <td style="padding: 15px; text-align: right;">₦${orderData.total.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
          
          <h3 style="color: #333;">Shipping Address</h3>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
            <p style="margin: 0; line-height: 1.6;">
              ${orderData.shippingAddress.firstName} ${orderData.shippingAddress.lastName}<br>
              ${orderData.shippingAddress.address}<br>
              ${orderData.shippingAddress.city}, ${orderData.shippingAddress.state}<br>
              ${orderData.shippingAddress.zipCode}<br>
              ${orderData.shippingAddress.country}
            </p>
          </div>
          
          <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #1976d2;">
              <strong>What's next?</strong><br>
              The vendor will process your order and provide tracking information once shipped.
            </p>
          </div>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px;">
          <p>Thank you for choosing Gote Marketplace!</p>
          <p>If you have any questions, please contact our support team.</p>
        </div>
      </div>
    `

    return await this.sendEmail({
      to: orderData.customerEmail,
      subject: `Order Confirmation #${orderData.orderId} - Gote Marketplace`,
      html: customerEmailHtml
    })
  }

  private async sendVendorOrderNotification(orderData: OrderEmailData): Promise<boolean> {
    const itemsList = orderData.items.map(item => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px; text-align: left;">
          <img src="${item.images?.[0] || ''}" alt="${item.title}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">
        </td>
        <td style="padding: 12px; text-align: left;">
          <strong>${item.title}</strong><br>
          <small style="color: #666;">SKU: ${item.sku || 'N/A'}</small><br>
          <small style="color: #666;">Qty: ${item.quantity}</small>
        </td>
        <td style="padding: 12px; text-align: right;">₦${(item.price * item.quantity).toLocaleString()}</td>
      </tr>
    `).join('')

    const vendorEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #4caf50; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">🎉 New Order Received!</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 5px 0;">You have a new order to process</p>
        </div>
        
        <div style="padding: 20px; background: white;">
          <h2 style="color: #333;">Hi ${orderData.vendorName},</h2>
          <p>Great news! You've received a new order. Here are the details:</p>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #333;">Order #${orderData.orderId}</h3>
            <p style="margin: 0; color: #666;">Customer: ${orderData.customerName}</p>
            <p style="margin: 5px 0; color: #666;">Email: ${orderData.customerEmail}</p>
          </div>
          
          <h3 style="color: #333;">Items to Ship</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="padding: 12px; text-align: left;">Product</th>
                <th style="padding: 12px; text-align: left;">Details</th>
                <th style="padding: 12px; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsList}
              <tr style="border-top: 2px solid #333; font-weight: bold;">
                <td colspan="2" style="padding: 15px; text-align: right;">Total Earnings:</td>
                <td style="padding: 15px; text-align: right;">₦${orderData.total.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
          
          <h3 style="color: #333;">Shipping Address</h3>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
            <p style="margin: 0; line-height: 1.6;">
              <strong>${orderData.shippingAddress.firstName} ${orderData.shippingAddress.lastName}</strong><br>
              ${orderData.shippingAddress.address}<br>
              ${orderData.shippingAddress.city}, ${orderData.shippingAddress.state}<br>
              ${orderData.shippingAddress.zipCode}<br>
              ${orderData.shippingAddress.country}<br>
              <strong>Phone:</strong> ${orderData.shippingAddress.phone || 'Not provided'}
            </p>
          </div>
          
          <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0; color: #856404;">
              <strong>Action Required:</strong><br>
              Please log in to your vendor dashboard to confirm this order and begin processing.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/vendor/orders" 
               style="background: #4caf50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Order in Dashboard
            </a>
          </div>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px;">
          <p>Thank you for being a valued vendor on Gote Marketplace!</p>
          <p>Process orders quickly to maintain high customer satisfaction ratings.</p>
        </div>
      </div>
    `

    return await this.sendEmail({
      to: orderData.vendorEmail,
      subject: `🎉 New Order #${orderData.orderId} - Action Required`,
      html: vendorEmailHtml
    })
  }
}

export const emailService = new EmailService()