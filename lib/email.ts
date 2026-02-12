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
    // Use Mailtrap for local development
    let smtpConfig: any;
    if (process.env.NODE_ENV === 'development') {
      smtpConfig = {
        host: process.env.MAILTRAP_HOST,
        port: parseInt(process.env.MAILTRAP_PORT || '2525'),
        auth: {
          user: process.env.MAILTRAP_USER,
          pass: process.env.MAILTRAP_PASS,
        },
        from: process.env.MAILTRAP_FROM || 'MakeItSell <noreply@makeitsell.org>',
        tls: { rejectUnauthorized: false },
        connectionTimeout: 60000,
        greetingTimeout: 30000,
        socketTimeout: 60000,
      }
    } else {
      smtpConfig = {
        host: process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587'),
        secure: process.env.EMAIL_PORT === '465' || process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER || process.env.SMTP_USER,
          pass: process.env.EMAIL_PASS || process.env.SMTP_PASS,
        },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 60000,
        greetingTimeout: 30000,
        socketTimeout: 60000,
      }
    }
    this.transporter = nodemailer.createTransport(smtpConfig)
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
    console.log('[emailService.sendEmail] Attempting to send email to:', emailData.to)
    console.log('[emailService.sendEmail] Subject:', emailData.subject)
    console.log('[emailService.sendEmail] From address:', process.env.EMAIL_FROM || `"${process.env.SMTP_FROM_NAME || 'Make It Sell'}" <${process.env.SMTP_FROM_EMAIL || process.env.EMAIL_USER}>`)
    
    try {
      const result = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || `"${process.env.SMTP_FROM_NAME || 'Make It Sell'}" <${process.env.SMTP_FROM_EMAIL || process.env.EMAIL_USER}>`,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        attachments: emailData.attachments,
      })
      
      console.log('[emailService.sendEmail] Email sent successfully to:', emailData.to)
      console.log('[emailService.sendEmail] Message ID:', result.messageId)
      return true
    } catch (error) {
      console.error('[emailService.sendEmail] Email sending failed for:', emailData.to)
      console.error('[emailService.sendEmail] Error details:', error)
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
    const deliveryEstimate = orderData.deliveryEstimate || this.calculateDeliveryEstimate()
    const orderDate = orderData.orderDate || new Date()
    
    const itemsList = orderData.items.map(item => `
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 12px; text-align: left; width: 80px;">
          <img src="${item.images?.[0] || '/placeholder-product.jpg'}" alt="${item.title}" 
               style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid #eee;">
        </td>
        <td style="padding: 12px; text-align: left;">
          <div style="font-weight: 600; color: #333; margin-bottom: 4px;">${item.title}</div>
          <div style="font-size: 12px; color: #666;">SKU: ${item.sku || 'N/A'}</div>
          <div style="font-size: 12px; color: #666;">Qty: ${item.quantity}</div>
        </td>
        <td style="padding: 12px; text-align: center; color: #666;">₦${item.price.toLocaleString()}</td>
        <td style="padding: 12px; text-align: right; font-weight: 600; color: #333;">₦${(item.price * item.quantity).toLocaleString()}</td>
      </tr>
    `).join('')

    const subtotal = orderData.total
    const deliveryFee = 0 // You can calculate this based on location
    const total = subtotal + deliveryFee

    const customerEmailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 300;">INVOICE</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 16px;">Order Confirmation</p>
        </div>
        
        <!-- Invoice Header -->
        <div style="background: white; padding: 30px; border-bottom: 1px solid #eee;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 50%; vertical-align: top;">
                <div style="margin-bottom: 20px;">
                  <h2 style="margin: 0 0 10px 0; color: #333; font-size: 18px;">Make It Sell</h2>
                  <div style="color: #666; font-size: 14px; line-height: 1.5;">
                    Lagos, Nigeria<br>
                    noreply@makeitsell.org
                  </div>
                </div>
              </td>
              <td style="width: 50%; vertical-align: top; text-align: right;">
                <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #667eea;">
                  <div style="font-size: 14px; color: #666; margin-bottom: 5px;">Invoice Number</div>
                  <div style="font-size: 18px; font-weight: 600; color: #333; margin-bottom: 10px;">#${orderData.orderId.substring(0, 8).toUpperCase()}</div>
                  <div style="font-size: 14px; color: #666; margin-bottom: 5px;">Order Date</div>
                  <div style="font-size: 14px; color: #333;">${orderDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                </div>
              </td>
            </tr>
          </table>
        </div>
        
        <!-- Customer & Vendor Info -->
        <div style="background: white; padding: 30px; border-bottom: 1px solid #eee;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 50%; vertical-align: top; padding-right: 20px;">
                <h3 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Bill To:</h3>
                <div style="color: #333; font-size: 14px; line-height: 1.6;">
                  <div style="font-weight: 600; margin-bottom: 8px;">${orderData.customerName}</div>
                  <div>${orderData.shippingAddress.address}</div>
                  <div>${orderData.shippingAddress.city}, ${orderData.shippingAddress.state}</div>
                  <div>${orderData.shippingAddress.zipCode}</div>
                  <div>${orderData.shippingAddress.country}</div>
                  <div style="margin-top: 8px; color: #666;">${orderData.customerEmail}</div>
                </div>
              </td>
              <td style="width: 50%; vertical-align: top; padding-left: 20px;">
                <h3 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Sold By:</h3>
                <div style="color: #333; font-size: 14px; line-height: 1.6;">
                  <div style="font-weight: 600; margin-bottom: 8px;">${orderData.vendorName}</div>
                  <div style="color: #666;">Make It Sell Vendor</div>
                </div>
              </td>
            </tr>
          </table>
        </div>

        <!-- Items Table -->
        <div style="background: white; padding: 30px;">
          <h3 style="margin: 0 0 20px 0; color: #333; font-size: 18px;">Order Items</h3>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #eee;">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="padding: 15px 12px; text-align: left; font-size: 13px; font-weight: 600; color: #333; border-bottom: 2px solid #eee;">Product</th>
                <th style="padding: 15px 12px; text-align: left; font-size: 13px; font-weight: 600; color: #333; border-bottom: 2px solid #eee;">Description</th>
                <th style="padding: 15px 12px; text-align: center; font-size: 13px; font-weight: 600; color: #333; border-bottom: 2px solid #eee;">Unit Price</th>
                <th style="padding: 15px 12px; text-align: right; font-size: 13px; font-weight: 600; color: #333; border-bottom: 2px solid #eee;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsList}
              <tr>
                <td colspan="4" style="padding: 0;"><div style="border-bottom: 1px solid #eee;"></div></td>
              </tr>
              <tr>
                <td colspan="3" style="padding: 15px 12px; text-align: right; font-size: 14px; color: #666;">Subtotal:</td>
                <td style="padding: 15px 12px; text-align: right; font-size: 14px; font-weight: 600; color: #333;">₦${subtotal.toLocaleString()}</td>
              </tr>
              <tr>
                <td colspan="3" style="padding: 12px; text-align: right; font-size: 14px; color: #666;">Delivery Fee:</td>
                <td style="padding: 12px; text-align: right; font-size: 14px; font-weight: 600; color: ${deliveryFee === 0 ? '#28a745' : '#333'};">${deliveryFee === 0 ? 'FREE' : '₦' + deliveryFee.toLocaleString()}</td>
              </tr>
              <tr style="border-top: 2px solid #333;">
                <td colspan="3" style="padding: 15px 12px; text-align: right; font-size: 16px; font-weight: 600; color: #333;">Total Amount:</td>
                <td style="padding: 15px 12px; text-align: right; font-size: 18px; font-weight: 700; color: #333;">₦${total.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <!-- Delivery Information -->
        <div style="background: white; padding: 30px; border-top: 1px solid #eee;">
          <h3 style="margin: 0 0 20px 0; color: #333; font-size: 18px;">🚚 Delivery Information</h3>
          <div style="background: linear-gradient(135deg, #667eea15, #764ba215); padding: 20px; border-radius: 8px; border: 1px solid #667eea30;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="width: 50%; padding-right: 20px; vertical-align: top;">
                  <div style="font-size: 14px; color: #666; margin-bottom: 5px;">Estimated Delivery</div>
                  <div style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 15px;">
                    ${deliveryEstimate.min === deliveryEstimate.max 
                      ? `${deliveryEstimate.min} day${deliveryEstimate.min > 1 ? 's' : ''}` 
                      : `${deliveryEstimate.min}-${deliveryEstimate.max} days`}
                  </div>
                  <div style="font-size: 13px; color: #666;">
                    Expected between:<br>
                    <strong>${this.formatDeliveryDate(deliveryEstimate.min)}</strong> - <strong>${this.formatDeliveryDate(deliveryEstimate.max)}</strong>
                  </div>
                </td>
                <td style="width: 50%; padding-left: 20px; vertical-align: top;">
                  <div style="font-size: 14px; color: #666; margin-bottom: 5px;">Delivery Address</div>
                  <div style="font-size: 14px; color: #333; line-height: 1.5;">
                    ${orderData.shippingAddress.firstName} ${orderData.shippingAddress.lastName}<br>
                    ${orderData.shippingAddress.address}<br>
                    ${orderData.shippingAddress.city}, ${orderData.shippingAddress.state}<br>
                    ${orderData.shippingAddress.zipCode}, ${orderData.shippingAddress.country}
                    ${orderData.shippingAddress.phone ? `<br>📱 ${orderData.shippingAddress.phone}` : ''}
                  </div>
                </td>
              </tr>
            </table>
          </div>
        </div>

        <!-- Next Steps -->
        <div style="background: white; padding: 30px;">
          <h3 style="margin: 0 0 20px 0; color: #333; font-size: 18px;">What happens next?</h3>
          <div style="display: flex; flex-direction: column; gap: 15px;">
            <div style="display: flex; align-items: flex-start;">
              <div style="width: 30px; height: 30px; background: #28a745; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; flex-shrink: 0;">
                <span style="color: white; font-size: 14px; font-weight: bold;">✓</span>
              </div>
              <div>
                <div style="font-weight: 600; color: #333; margin-bottom: 4px;">Order Confirmed</div>
                <div style="font-size: 14px; color: #666;">Your payment has been processed and your order is confirmed.</div>
              </div>
            </div>
            <div style="display: flex; align-items: flex-start;">
              <div style="width: 30px; height: 30px; background: #ffc107; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; flex-shrink: 0;">
                <span style="color: white; font-size: 14px; font-weight: bold;">2</span>
              </div>
              <div>
                <div style="font-weight: 600; color: #333; margin-bottom: 4px;">Processing</div>
                <div style="font-size: 14px; color: #666;">The vendor is preparing your items for shipment.</div>
              </div>
            </div>
            <div style="display: flex; align-items: flex-start;">
              <div style="width: 30px; height: 30px; background: #6c757d; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; flex-shrink: 0;">
                <span style="color: white; font-size: 14px; font-weight: bold;">3</span>
              </div>
              <div>
                <div style="font-weight: 600; color: #333; margin-bottom: 4px;">Shipped</div>
                <div style="font-size: 14px; color: #666;">You'll receive tracking information when your order ships.</div>
              </div>
            </div>
            <div style="display: flex; align-items: flex-start;">
              <div style="width: 30px; height: 30px; background: #6c757d; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; flex-shrink: 0;">
                <span style="color: white; font-size: 14px; font-weight: bold;">4</span>
              </div>
              <div>
                <div style="font-weight: 600; color: #333; margin-bottom: 4px;">Delivered</div>
                <div style="font-size: 14px; color: #666;">Your order will arrive within the estimated timeframe.</div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #eee;">
          <h3 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Thank you for shopping with us!</h3>
          <p style="margin: 0 0 20px 0; color: #666; font-size: 14px;">If you have any questions about your order, please don't hesitate to contact us.</p>
          
          <div style="margin: 20px 0;">
            <a href="mailto:noreply@makeitsell.org" 
               style="background: #667eea; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600; margin-right: 10px;">
              Contact Support
            </a>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/order?orderId=${orderData.orderId}" 
               style="background: white; color: #667eea; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600; border: 2px solid #667eea;">
              Track Order
            </a>
          </div>
          
          <div style="color: #999; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="margin: 0;">Make It Sell - Lagos, Nigeria</p>
            <p style="margin: 5px 0 0 0;">This is an automated email. Please do not reply to this email.</p>
          </div>
        </div>
      </div>
    `

    return await this.sendEmail({
      to: orderData.customerEmail,
      subject: `Invoice #${orderData.orderId.substring(0, 8).toUpperCase()} - Make It Sell`,
      html: customerEmailHtml
    })
  }

  private async sendVendorOrderNotification(orderData: OrderEmailData): Promise<boolean> {
    const deliveryEstimate = orderData.deliveryEstimate || this.calculateDeliveryEstimate()
    const orderDate = orderData.orderDate || new Date()
    
    const itemsList = orderData.items.map(item => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px; text-align: left;">
          <img src="${item.images?.[0] || '/placeholder-product.jpg'}" alt="${item.title}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">
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
            <h3 style="margin: 0 0 10px 0; color: #333;">Order #${orderData.orderId.substring(0, 8).toUpperCase()}</h3>
            <p style="margin: 0; color: #666;">Customer: ${orderData.customerName}</p>
            <p style="margin: 5px 0; color: #666;">Email: ${orderData.customerEmail}</p>
            <p style="margin: 5px 0; color: #666;">Order Date: ${orderDate.toLocaleDateString()}</p>
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
              <strong>📦 Delivery Target:</strong><br>
              Please ensure items are shipped within ${deliveryEstimate.min === deliveryEstimate.max 
                ? `${deliveryEstimate.min} day${deliveryEstimate.min > 1 ? 's' : ''}` 
                : `${deliveryEstimate.min}-${deliveryEstimate.max} days`} to meet customer expectations.<br>
              <small>Expected delivery: ${this.formatDeliveryDate(deliveryEstimate.min)} - ${this.formatDeliveryDate(deliveryEstimate.max)}</small>
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
          <p>Thank you for being a valued vendor on Make It Sell!</p>
          <p>Process orders quickly to maintain high customer satisfaction ratings.</p>
        </div>
      </div>
    `

    return await this.sendEmail({
      to: orderData.vendorEmail,
      subject: `🎉 New Order #${orderData.orderId.substring(0, 8).toUpperCase()} - Action Required`,
      html: vendorEmailHtml
    })
  }

  // Generic email sender for subscription confirmations
  async sendSubscriptionEmail(to: string, subject: string, data: any): Promise<boolean> {
    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 30px; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">🎉 Payment Confirmed!</h1>
          <p style="color: white; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your subscription is now active</p>
        </div>

        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
          <h2 style="color: #333; margin: 0 0 15px 0; font-size: 20px;">Subscription Details</h2>
          <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745;">
            <p style="margin: 0 0 8px 0; color: #666;"><strong>Amount Paid:</strong> ${data.amount}</p>
            <p style="margin: 0 0 8px 0; color: #666;"><strong>Subscription Period:</strong> ${data.subscriptionPeriod}</p>
            <p style="margin: 0; color: #666;"><strong>Reference:</strong> ${data.reference}</p>
          </div>
        </div>

        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 10px; border-left: 4px solid #28a745; margin-bottom: 20px;">
          <h3 style="color: #155724; margin: 0 0 10px 0; font-size: 16px;">✅ What's Next?</h3>
          <ul style="color: #155724; margin: 0; padding-left: 20px;">
            <li>Your store is now visible to customers</li>
            <li>You can start listing products and services</li>
            <li>Access your vendor dashboard to manage your store</li>
            <li>Your subscription will auto-renew next month</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/vendor/dashboard" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 12px 25px; border-radius: 6px; font-weight: 600;">Go to Dashboard</a>
        </div>

        <hr style="border: none; height: 1px; background-color: #eee; margin: 30px 0;">
        
        <div style="text-align: center; color: #666; font-size: 14px;">
          <p style="margin: 0 0 10px 0;">Thank you for choosing Make It Sell!</p>
          <p style="margin: 0;">Questions? Contact us at <a href="mailto:noreply@makeitsell.org" style="color: #667eea;">noreply@makeitsell.org</a></p>
        </div>
      </div>
    `

    return await this.sendEmail({
      to,
      subject,
      html: emailHtml
    })
  }

  async sendPasswordResetEmail({ email, name, resetUrl, resetToken }: {
    email: string
    name: string
    resetUrl: string
    resetToken: string
  }): Promise<boolean> {
    console.log('[emailService] Sending password reset email to:', email)
    console.log('[emailService] Reset URL:', resetUrl)
    
    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; padding: 0; background-color: #ffffff; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);">
        <!-- Header with Logo -->
        <div style="text-align: center; padding: 40px 20px; background: linear-gradient(135deg, oklch(0.35 0.15 15) 0%, oklch(0.45 0.18 20) 100%); border-radius: 12px 12px 0 0; position: relative; overflow: hidden;">
          <div style="position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%); animation: float 6s ease-in-out infinite;"></div>
          <div style="position: relative; z-index: 1;">
            <img src="https://makeitsell.org/images/logo (2).png" alt="Make It Sell Logo" style="height: 60px; width: auto; margin-bottom: 20px; filter: brightness(0) invert(1);" />
            <h1 style="color: white; margin: 0 0 10px 0; font-size: 32px; font-weight: 800; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">🔑 Password Reset</h1>
            <p style="color: rgba(255, 255, 255, 0.95); margin: 0; font-size: 16px; line-height: 1.5; font-weight: 400;">
              Secure access to your Make It Sell account
            </p>
          </div>
        </div>

        <!-- Main Content -->
        <div style="padding: 40px 30px;">
          <!-- Personalized Greeting -->
          <div style="text-align: center; margin-bottom: 30px;">
            <h2 style="color: #1a1a1a; margin: 0 0 10px 0; font-size: 26px; font-weight: 700;">Hello ${name}! 👋</h2>
            <p style="color: #666666; margin: 0; font-size: 16px; line-height: 1.6;">
              We received a request to reset your password. No worries - we've got you covered!
            </p>
          </div>

          <!-- Reset Instructions Card -->
          <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding: 30px; border-radius: 16px; margin-bottom: 30px; border: 1px solid #e2e8f0; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);">
            <h3 style="color: #1a1a1a; margin: 0 0 15px 0; font-size: 20px; font-weight: 700; display: flex; align-items: center;">
              🚀 Quick Reset Instructions
            </h3>
            <p style="color: #4a5568; margin: 0 0 20px 0; line-height: 1.7; font-size: 15px;">
              Click the button below to securely reset your password. This link will expire in <strong style="color: oklch(0.35 0.15 15);">30 minutes</strong> for your security.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="display: inline-block; background: linear-gradient(135deg, oklch(0.35 0.15 15) 0%, oklch(0.45 0.18 20) 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 8px 24px oklch(0.35 0.15 15 / 0.4); transform: translateY(0); transition: all 0.3s ease;">
                🔑 Reset My Password Now
              </a>
            </div>
          </div>

          <!-- Security Information -->
          <div style="background: linear-gradient(135deg, #fef7f0 0%, #fdeee4 100%); padding: 25px; border-radius: 12px; border-left: 5px solid #f97316; margin-bottom: 25px;">
            <h3 style="color: #9a3412; margin: 0 0 12px 0; font-size: 16px; font-weight: 700; display: flex; align-items: center;">
              🛡️ Security Notice
            </h3>
            <ul style="color: #9a3412; margin: 0; padding-left: 0; list-style: none; line-height: 1.7;">
              <li style="margin-bottom: 8px; display: flex; align-items: flex-start;"><span style="color: #f97316; margin-right: 8px; font-weight: bold;">•</span> This link expires in exactly 30 minutes</li>
              <li style="margin-bottom: 8px; display: flex; align-items: flex-start;"><span style="color: #f97316; margin-right: 8px; font-weight: bold;">•</span> If you didn't request this, you can safely ignore this email</li>
              <li style="margin-bottom: 0; display: flex; align-items: flex-start;"><span style="color: #f97316; margin-right: 8px; font-weight: bold;">•</span> Your password won't change unless you click the button</li>
            </ul>
          </div>

          <!-- Alternative Access -->
          <div style="background: linear-gradient(135deg, #f0fdf4 0%, #e6ffed 100%); padding: 20px; border-radius: 12px; border-left: 5px solid oklch(0.35 0.15 15); margin-bottom: 30px;">
            <h4 style="color: #15803d; margin: 0 0 12px 0; font-weight: 700; font-size: 14px; display: flex; align-items: center;">
              🔗 Button not working?
            </h4>
            <p style="color: #166534; margin: 0 0 10px 0; font-size: 14px; line-height: 1.6;">
              Copy and paste this link into your browser:
            </p>
            <div style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #bbf7d0; word-break: break-all;">
              <code style="font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; font-size: 12px; color: #374151; line-height: 1.4;">${resetUrl}</code>
            </div>
          </div>

          <!-- Development Token (only in dev mode) -->
          ${process.env.NODE_ENV === 'development' ? `
          <div style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); padding: 20px; border-radius: 12px; border-left: 5px solid #f59e0b; margin-bottom: 25px;">
            <h4 style="color: #d97706; margin: 0 0 12px 0; font-weight: 700; font-size: 14px; display: flex; align-items: center;">
              🛠️ Development Mode Only
            </h4>
            <p style="color: #d97706; margin: 0 0 8px 0; font-size: 13px;">
              Manual token for testing:
            </p>
            <code style="background: white; padding: 8px 12px; border-radius: 6px; font-family: 'Monaco', 'Menlo', monospace; font-size: 12px; color: #374151; border: 1px solid #fcd34d; display: inline-block;">${resetToken}</code>
          </div>
          ` : ''}

          <!-- Support Section -->
          <div style="text-align: center; padding: 25px 0; border-top: 2px solid #f1f5f9; margin-top: 20px;">
            <h4 style="color: #374151; margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">
              Need Help? We're Here! 🙋‍♂️
            </h4>
            <p style="color: #6b7280; margin: 0 0 15px 0; font-size: 14px; line-height: 1.6;">
              Having trouble with your password reset? Our support team is ready to help.
            </p>
            <a href="mailto:noreply@makeitsell.org" 
               style="color: oklch(0.35 0.15 15); text-decoration: none; font-weight: 600; font-size: 15px; display: inline-flex; align-items: center; background: #f8fafc; padding: 10px 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
               📧 noreply@makeitsell.org
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; color: #94a3b8; font-size: 12px; padding: 20px 30px; background: #f8fafc; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
          <div style="margin-bottom: 15px;">
            <img src="https://makeitsell.org/images/logo (2).png" alt="Make It Sell" style="height: 20px; width: auto; opacity: 0.6;" />
          </div>
          <p style="margin: 0 0 8px 0; line-height: 1.5;">
            This email was sent to <strong style="color: #64748b;">${email}</strong>
          </p>
          <p style="margin: 0; line-height: 1.5;">
            If you didn't request this password reset, you can safely ignore this email.
          </p>
          <p style="margin: 12px 0 0 0; font-size: 11px; color: #a1a1aa;">
            © 2026 Make It Sell Marketplace. All rights reserved.
          </p>
        </div>
      </div>
    `

    return await this.sendEmail({
      to: email,
      subject: '🔑 Reset your password - Make It Sell',
      html: emailHtml
    })
  }

  async sendEmailVerification({ email, name, verificationUrl }: {
    email: string
    name: string
    verificationUrl: string
  }): Promise<boolean> {
    console.log('[emailService] Sending verification email to:', email)
    console.log('[emailService] Verification URL:', verificationUrl)
    console.log('[emailService] SMTP Config:', {
      host: process.env.EMAIL_HOST || process.env.SMTP_HOST,
      port: process.env.EMAIL_PORT || process.env.SMTP_PORT,
      user: process.env.EMAIL_USER || process.env.SMTP_USER,
      from: process.env.EMAIL_FROM || `"${process.env.SMTP_FROM_NAME || 'Make It Sell'}" <${process.env.SMTP_FROM_EMAIL || process.env.EMAIL_USER}>`
    })
    
    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px; padding: 20px; background: linear-gradient(135deg, oklch(0.35 0.15 15) 0%, oklch(0.45 0.18 20) 100%); border-radius: 10px;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">📧 Verify Your Email</h1>
          <p style="color: white; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Complete your account setup</p>
        </div>

        <!-- Welcome Message -->
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="color: oklch(0.295 0.014 258.338); margin: 0 0 10px 0; font-size: 24px;">Welcome to Make It Sell, ${name}!</h2>
          <p style="color: oklch(0.631 0 0); margin: 0; font-size: 16px; line-height: 1.5;">
            Thanks for joining our marketplace! To get started, please verify your email address.
          </p>
        </div>

        <!-- Verification Instructions -->
        <div style="background-color: oklch(0.976 0 0); padding: 25px; border-radius: 10px; margin-bottom: 25px; border: 1px solid oklch(0.898 0 0);">
          <h3 style="color: oklch(0.295 0.014 258.338); margin: 0 0 15px 0; font-size: 18px;">Just one more step...</h3>
          <p style="color: oklch(0.631 0 0); margin: 0 0 20px 0; line-height: 1.6;">
            Click the button below to verify your email address and activate your account. 
            This link will expire in 24 hours for security reasons.
          </p>
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="${verificationUrl}" 
               style="display: inline-block; background: linear-gradient(135deg, oklch(0.35 0.15 15) 0%, oklch(0.45 0.18 20) 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px oklch(0.35 0.15 15 / 0.3);">
              ✅ Verify My Email
            </a>
          </div>
        </div>

        <!-- Benefits -->
        <div style="background-color: oklch(0.35 0.15 15 / 0.05); padding: 20px; border-radius: 10px; border-left: 4px solid oklch(0.35 0.15 15); margin-bottom: 25px;">
          <h3 style="color: oklch(0.295 0.014 258.338); margin: 0 0 15px 0; font-size: 16px;">🎉 Once verified, you can:</h3>
          <ul style="color: oklch(0.295 0.014 258.338); margin: 0; padding-left: 20px; line-height: 1.6;">
            <li>Browse and purchase thousands of products</li>
            <li>Create your own store and start selling</li>
            <li>Access exclusive deals and promotions</li>
            <li>Get personalized recommendations</li>
            <li>Track your orders and manage your account</li>
          </ul>
        </div>

        <!-- Alternative Link -->
        <div style="background-color: oklch(0.35 0.15 15 / 0.08); padding: 15px; border-radius: 8px; border-left: 4px solid oklch(0.35 0.15 15); margin-bottom: 25px;">
          <p style="color: oklch(0.295 0.014 258.338); margin: 0 0 10px 0; font-weight: 600; font-size: 14px;">
            🔗 Can't click the button?
          </p>
          <p style="color: oklch(0.295 0.014 258.338); margin: 0; font-size: 14px; line-height: 1.5;">
            Copy and paste this link into your browser:<br>
            <span style="word-break: break-all; font-family: monospace; background: oklch(0.898 0 0); padding: 2px 4px; border-radius: 3px;">
              ${verificationUrl}
            </span>
          </p>
        </div>

        <!-- Support -->
        <div style="text-align: center; color: oklch(0.631 0 0); font-size: 14px; padding-top: 20px; border-top: 1px solid oklch(0.898 0 0);">
          <p style="margin: 0 0 10px 0;">
            Having trouble? We're here to help!
          </p>
          <p style="margin: 0;">
            Contact us at <a href="mailto:noreply@makeitsell.org" style="color: oklch(0.35 0.15 15); text-decoration: none; font-weight: 600;">noreply@makeitsell.org</a>
          </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; color: oklch(0.631 0 0); font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid oklch(0.898 0 0);">
          <p style="margin: 0;">
            This email was sent to ${email}. If you didn't create an account, you can safely ignore this email.
          </p>
        </div>
      </div>
    `

    return await this.sendEmail({
      to: email,
      subject: 'Verify your email address - Make It Sell',
      html: emailHtml
    })
  }
}

export const emailService = new EmailService()

// Export convenience functions
export const sendEmail = async (to: string, subject: string, template: string, data: any) => {
  if (template === 'subscription-confirmed') {
    return await emailService.sendSubscriptionEmail(to, subject, data)
  }
  
  // Default to basic email
  return await emailService.sendEmail({
    to,
    subject,
    html: `<p>Email template "${template}" not found. Data: ${JSON.stringify(data)}</p>`
  })
}