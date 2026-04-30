import nodemailer from 'nodemailer'
import fs from 'fs'
import path from 'path'
import { getCanonicalAppBaseUrl } from './app-url'

// --- Standalone helpers for email status update ---
function getOrderItemImageUrl(item: any): string {
  const rawImage =
    (Array.isArray(item?.images) && item.images[0]) ||
    item?.image ||
    item?.productImage ||
    item?.thumbnail ||
    (Array.isArray(item?.product?.images) && item.product.images[0]) ||
    item?.product?.image ||
    '/images/placeholder-product.svg';
  return toAbsoluteUrl(rawImage);
}

function toAbsoluteUrl(value: string | undefined | null): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }
  if (/^https?:\/\//i.test(trimmed) || /^data:/i.test(trimmed)) {
    return trimmed;
  }
  const base = getCanonicalAppBaseUrl();
  if (trimmed.startsWith('/')) {
    return `${base}${trimmed}`;
  }
  return `${base}/${trimmed}`;
}

interface EmailData {
  to: string
  subject: string
  html: string
  text?: string
  replyTo?: string
  headers?: Record<string, string>
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
  productSubtotal?: number
  deliveryFee?: number
  shippingAddress: any
  deliveryEstimate?: { min: number; max: number }
  orderDate?: Date
  sendCustomerCopy?: boolean
  sendVendorCopy?: boolean
}

interface OrderStatusUpdateEmailData {
  to: string
  orderId: string
  status: string
  statusLabel: string
  customerName: string
  vendorName: string
  items: any[]
  total: number
  productSubtotal?: number
  deliveryFee?: number
  shippingAddress: any
  role: 'customer' | 'vendor'
}

export type RegistrationIssueTemplateOverrides = {
  subject?: string
  body?: string
  headerTitle?: string
  headerSubtitle?: string
  posterImageUrl?: string
  posterWidthPx?: number
  posterHeightPx?: number
  posterXOffsetPx?: number
  posterYOffsetPx?: number
  loginButtonText?: string
  signupButtonText?: string
  eSignatureText?: string
  signatureImageUrl?: string
  senderName?: string
  senderTitle?: string
  senderCompany?: string
  signatureWidthPx?: number
  signatureHeightPx?: number
  signatureXOffsetPx?: number
  signatureYOffsetPx?: number
}

class EmailService {
  private transporter: nodemailer.Transporter
  private lastDeliveryError: string | null = null

  private getEnv(...keys: string[]): string {
    for (const key of keys) {
      const raw = process.env[key]
      if (raw === undefined || raw === null) continue
      const trimmed = String(raw).trim()
      if (!trimmed) continue
      if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ) {
        return trimmed.slice(1, -1).trim()
      }
      return trimmed
    }
    return ''
  }

  getLastDeliveryError(): string | null {
    return this.lastDeliveryError
  }

  private parseSimpleEnvFile(filePath: string): Record<string, string> {
    if (!fs.existsSync(filePath)) return {}

    const content = fs.readFileSync(filePath, 'utf8')
    const env: Record<string, string> = {}

    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      const eqIndex = trimmed.indexOf('=')
      if (eqIndex <= 0) continue

      const key = trimmed.slice(0, eqIndex).trim()
      let value = trimmed.slice(eqIndex + 1).trim()

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }

      env[key] = value
    }

    return env
  }

  private async tryFallbackEnvFileSmtp(emailData: EmailData): Promise<boolean> {
    try {
      const root = process.cwd()
      const envFromFile = {
        ...this.parseSimpleEnvFile(path.join(root, '.env')),
        ...this.parseSimpleEnvFile(path.join(root, '.env.local')),
      }

      const host = envFromFile.EMAIL_HOST || envFromFile.SMTP_HOST
      const user = envFromFile.EMAIL_USER || envFromFile.SMTP_USER
      const pass = envFromFile.EMAIL_PASS || envFromFile.SMTP_PASS

      if (!host || !user || !pass) {
        return false
      }

      const configuredPort = Number(envFromFile.EMAIL_PORT || envFromFile.SMTP_PORT || '587')
      const configuredSecure =
        String(envFromFile.SMTP_SECURE || '').toLowerCase() === 'true' || configuredPort === 465

      const from =
        envFromFile.EMAIL_FROM ||
        `"${envFromFile.SMTP_FROM_NAME || 'Make It Sell Support'}" <${envFromFile.SUPPORT_EMAIL || envFromFile.SMTP_FROM_EMAIL || user}>`

      const configs = [
        { port: configuredPort, secure: configuredSecure },
        { port: 587, secure: false },
        { port: 465, secure: true },
      ]

      for (const cfg of configs) {
        try {
          const transporter = nodemailer.createTransport({
            host,
            port: cfg.port,
            secure: cfg.secure,
            auth: { user, pass },
            tls: { rejectUnauthorized: false },
            connectionTimeout: 60000,
            greetingTimeout: 30000,
            socketTimeout: 60000,
          })

          await transporter.verify()

          const result = await transporter.sendMail({
            from,
            to: emailData.to,
            subject: emailData.subject,
            html: emailData.html,
            text: emailData.text || this.htmlToText(emailData.html),
            replyTo: emailData.replyTo || envFromFile.EMAIL_REPLY_TO || envFromFile.SUPPORT_EMAIL,
            headers: {
              'X-Auto-Response-Suppress': 'OOF, AutoReply',
              'Auto-Submitted': 'auto-generated',
              ...(emailData.headers || {}),
            },
            attachments: emailData.attachments,
          })

          const accepted = Array.isArray((result as any)?.accepted) ? (result as any).accepted : []
          const rejected = Array.isArray((result as any)?.rejected) ? (result as any).rejected : []
          if (accepted.length > 0 && rejected.length === 0) {
            console.log('[emailService.sendEmail] Fallback SMTP auth succeeded via env file')
            return true
          }
        } catch (fallbackError) {
          console.error('[emailService.sendEmail] Fallback SMTP attempt failed:', fallbackError)
        }
      }

      return false
    } catch (error) {
      console.error('[emailService.sendEmail] Fallback SMTP path errored:', error)
      return false
    }
  }

  constructor() {
    // Prefer Mailtrap in local development only when fully configured.
    let smtpConfig: any;
    const mailtrapHost = this.getEnv('MAILTRAP_HOST')
    const mailtrapPort = this.getEnv('MAILTRAP_PORT')
    const mailtrapUser = this.getEnv('MAILTRAP_USER')
    const mailtrapPass = this.getEnv('MAILTRAP_PASS')

    const hasMailtrapConfig = !!(
      mailtrapHost &&
      mailtrapPort &&
      mailtrapUser &&
      mailtrapPass
    )

    if (process.env.NODE_ENV === 'development' && hasMailtrapConfig) {
      smtpConfig = {
        host: mailtrapHost,
        port: parseInt(mailtrapPort || '2525'),
        auth: {
          user: mailtrapUser,
          pass: mailtrapPass,
        },
        from: this.getEnv('MAILTRAP_FROM') || 'MakeItSell <support@makeitsell.ng>',
        tls: { rejectUnauthorized: false },
        connectionTimeout: 60000,
        greetingTimeout: 30000,
        socketTimeout: 60000,
      }
    } else {
      if (process.env.NODE_ENV === 'development' && !hasMailtrapConfig) {
        console.warn('[emailService] MAILTRAP_* vars not fully configured. Falling back to EMAIL_*/SMTP_* settings in development.')
      }

      const smtpHost = this.getEnv('EMAIL_HOST', 'SMTP_HOST') || 'smtp.gmail.com'
      const smtpPortRaw = this.getEnv('EMAIL_PORT', 'SMTP_PORT') || '587'
      const smtpPort = parseInt(smtpPortRaw || '587')
      const smtpSecureRaw = this.getEnv('SMTP_SECURE')
      const smtpSecure = smtpSecureRaw.toLowerCase() === 'true' || smtpPort === 465

      smtpConfig = {
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: this.getEnv('EMAIL_USER', 'SMTP_USER'),
          pass: this.getEnv('EMAIL_PASS', 'SMTP_PASS'),
        },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 60000,
        greetingTimeout: 30000,
        socketTimeout: 60000,
      }
    }
    this.transporter = nodemailer.createTransport(smtpConfig)
  }

  private getFromAddress(): string {
    const supportEmail = this.getEnv('SUPPORT_EMAIL')
    if (supportEmail) {
      return `"${this.getEnv('SMTP_FROM_NAME') || 'Make It Sell Support'}" <${supportEmail}>`
    }

    const configuredFrom = this.getEnv('EMAIL_FROM')
    if (configuredFrom) {
      if (configuredFrom.toLowerCase().includes('noreply@')) {
        return `"${process.env.SMTP_FROM_NAME || 'Make It Sell Support'}" <support@makeitsell.ng>`
      }
      return configuredFrom
    }

    const fallbackEmail =
      this.getEnv('SMTP_FROM_EMAIL') ||
      this.getEnv('EMAIL_USER', 'SMTP_USER') ||
      'support@makeitsell.ng'

    return `"${this.getEnv('SMTP_FROM_NAME') || 'Make It Sell Support'}" <${fallbackEmail}>`
  }

  private getAppBaseUrl(): string {
    return getCanonicalAppBaseUrl()
  }

  private toAbsoluteUrl(value: string | undefined | null): string {
    const trimmed = String(value || '').trim()
    if (!trimmed) return ''
    if (trimmed.startsWith('//')) {
      return `https:${trimmed}`
    }
    if (/^https?:\/\//i.test(trimmed) || /^data:/i.test(trimmed)) {
      return trimmed
    }

    const base = this.getAppBaseUrl()
    if (trimmed.startsWith('/')) {
      return `${base}${trimmed}`
    }
    return `${base}/${trimmed}`
  }

  private getOrderItemImageUrl(item: any): string {
    const rawImage =
      (Array.isArray(item?.images) && item.images[0]) ||
      item?.image ||
      item?.productImage ||
      item?.thumbnail ||
      (Array.isArray(item?.product?.images) && item.product.images[0]) ||
      item?.product?.image ||
      '/images/placeholder-product.svg'

    return this.toAbsoluteUrl(rawImage)
  }

  private getVendorOrdersUrl(): string {
    const base = this.getAppBaseUrl()
    return `${base}/vendor/orders`
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  private clampNumber(value: unknown, min: number, max: number, fallback: number): number {
    const n = Number(value)
    if (!Number.isFinite(n)) return fallback
    return Math.max(min, Math.min(max, Math.round(n)))
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms))
  }

  private async sendViaResend(emailData: EmailData): Promise<boolean> {
    try {
      const apiKey = this.getEnv('RESEND_API_KEY')
      if (!apiKey) return false

      const fromAddress = String(
        this.getEnv('RESEND_FROM') ||
        this.getEnv('RESEND_DEFAULT_FROM') ||
        'Make It Sell <verify@makeitsell.ng>'
      ).trim()

      const toAddress = String(emailData.to || '').trim()
      if (!toAddress) {
        this.lastDeliveryError = 'Resend recipient email is empty'
        return false
      }

      const replyTo = String(emailData.replyTo || this.getEnv('EMAIL_REPLY_TO', 'SUPPORT_EMAIL') || '').trim()

      const payloadBase: Record<string, any> = {
        to: [emailData.to],
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text || this.htmlToText(emailData.html),
        headers: emailData.headers || {},
      }

      if (replyTo) {
        payloadBase.reply_to = replyTo
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          ...payloadBase,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.id) {
        const errors = Array.isArray(payload?.errors)
          ? payload.errors
              .map((entry: any) => String(entry?.message || entry?.name || '').trim())
              .filter(Boolean)
              .join('; ')
          : ''
        this.lastDeliveryError = String(
          payload?.message ||
          payload?.error ||
          errors ||
          payload?.name ||
          `Resend HTTP ${response.status}`
        )
        console.error('[emailService.sendViaResend] Failed:', payload)
        return false
      }

      console.log('[emailService.sendViaResend] Email sent successfully via Resend:', {
        to: emailData.to,
        id: payload.id,
      })
      return true
    } catch (error: any) {
      this.lastDeliveryError = String(error?.message || 'Resend send failed')
      console.error('[emailService.sendViaResend] Error:', error)
      return false
    }
  }

  private isRetryableEmailError(error: any): boolean {
    const responseCode = Number(error?.responseCode)
    const code = String(error?.code || '').toUpperCase()

    if ([421, 425, 429, 450, 451, 452, 454].includes(responseCode)) return true
    if (responseCode >= 500 && responseCode < 600) return true

    return ['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'ECONNRESET', 'EAI_AGAIN'].includes(code)
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
    this.lastDeliveryError = null
    const provider = this.getEnv('EMAIL_DELIVERY_PROVIDER').toLowerCase()

    if (provider === 'resend' || (!!this.getEnv('RESEND_API_KEY') && provider !== 'smtp-only')) {
      const resendOk = await this.sendViaResend(emailData)
      if (resendOk) return true

      if (provider === 'resend') {
        console.warn('[emailService.sendEmail] Resend failed; falling back to SMTP path')
      }
    }

    console.log('[emailService.sendEmail] Attempting to send email to:', emailData.to)
    console.log('[emailService.sendEmail] Subject:', emailData.subject)
    console.log('[emailService.sendEmail] From address:', this.getFromAddress())

    const maxAttempts = 3

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await this.transporter.sendMail({
          from: this.getFromAddress(),
          to: emailData.to,
          subject: emailData.subject,
          html: emailData.html,
          text: emailData.text || this.htmlToText(emailData.html),
          replyTo: emailData.replyTo || process.env.EMAIL_REPLY_TO || process.env.SUPPORT_EMAIL,
          headers: {
            'X-Auto-Response-Suppress': 'OOF, AutoReply',
            'Auto-Submitted': 'auto-generated',
            ...(emailData.headers || {}),
          },
          attachments: emailData.attachments,
        })

        const accepted = Array.isArray((result as any)?.accepted) ? (result as any).accepted : []
        const rejected = Array.isArray((result as any)?.rejected) ? (result as any).rejected : []
        const pending = Array.isArray((result as any)?.pending) ? (result as any).pending : []

        console.log('[emailService.sendEmail] SMTP delivery status:', {
          to: emailData.to,
          accepted: accepted.length,
          rejected: rejected.length,
          pending: pending.length,
          response: (result as any)?.response,
        })

        if (accepted.length === 0 || rejected.length > 0) {
          this.lastDeliveryError = `SMTP rejected recipient (${emailData.to}). Response: ${String((result as any)?.response || '')}`
          console.error('[emailService.sendEmail] Recipient rejected by SMTP provider:', {
            to: emailData.to,
            accepted,
            rejected,
            response: (result as any)?.response,
          })
          return false
        }

        console.log('[emailService.sendEmail] Email sent successfully to:', emailData.to)
        console.log('[emailService.sendEmail] Message ID:', result.messageId)
        return true
      } catch (error) {
        const retryable = this.isRetryableEmailError(error)
        const code = String((error as any)?.code || '').toUpperCase()
        console.error(`[emailService.sendEmail] Attempt ${attempt}/${maxAttempts} failed for:`, emailData.to)
        console.error('[emailService.sendEmail] Error details:', error)

        if (code === 'EAUTH') {
          const fallbackOk = await this.tryFallbackEnvFileSmtp(emailData)
          if (fallbackOk) return true
        }

        this.lastDeliveryError = String((error as any)?.message || 'Email send failed')

        if (!retryable || attempt === maxAttempts) {
          return false
        }

        const delayMs = 700 * attempt
        console.log(`[emailService.sendEmail] Retrying in ${delayMs}ms...`)
        await this.sleep(delayMs)
      }
    }

    return false
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
      
      const shouldSendCustomer = orderData.sendCustomerCopy !== false
      const shouldSendVendor = orderData.sendVendorCopy !== false

      let customerEmailSent = true
      let vendorEmailSent = true

      if (shouldSendCustomer) {
        customerEmailSent = await this.sendCustomerOrderConfirmation(orderData)
      }

      if (shouldSendVendor) {
        vendorEmailSent = await this.sendVendorOrderNotification(orderData)
      }

      return customerEmailSent && vendorEmailSent
    } catch (error) {
      console.error('Failed to send order emails:', error)
      return false
    }
  }

  async sendOrderStatusUpdateEmail(data: OrderStatusUpdateEmailData): Promise<boolean> {
    try {
      const appBase = this.getAppBaseUrl()
      const shortOrderId = String(data.orderId || '').substring(0, 8).toUpperCase()
      const greetingName = data.role === 'vendor' ? data.vendorName : data.customerName
      const subtitle = data.role === 'vendor'
        ? `Order #${shortOrderId} for ${data.customerName}`
        : `Order #${shortOrderId} from ${data.vendorName}`
      const productSubtotal = Number.isFinite(Number(data.productSubtotal))
        ? Number(data.productSubtotal)
        : (Array.isArray(data.items)
          ? data.items.reduce((sum, item) => sum + (Number(item?.price || 0) * Number(item?.quantity || 1)), 0)
          : 0)
      const deliveryFee = Number.isFinite(Number(data.deliveryFee))
        ? Number(data.deliveryFee)
        : Math.max(0, Number(data.total || 0) - productSubtotal)
      const total = productSubtotal + deliveryFee

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
          <div style="background: #7f1d1d; color: #fff; padding: 20px;">
            <h1 style="margin: 0; font-size: 24px;">Order Status Update</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.92;">${data.statusLabel}</p>
          </div>
          <div style="padding: 20px;">
            <p style="margin: 0 0 12px 0;">Hi ${this.escapeHtml(String(greetingName || 'there'))},</p>
            <p style="margin: 0 0 12px 0;">${this.escapeHtml(subtitle)}</p>
            <div style="background: #f7f7f8; border: 1px solid #ececec; border-radius: 8px; padding: 12px;">
              <p style="margin: 0 0 6px 0;"><strong>Current stage:</strong> ${this.escapeHtml(data.statusLabel)}</p>
              <p style="margin: 0 0 6px 0;"><strong>Order ID:</strong> ${shortOrderId}</p>
              <p style="margin: 0 0 6px 0;"><strong>Product subtotal:</strong> ₦${productSubtotal.toLocaleString('en-NG')}</p>
              <p style="margin: 0 0 6px 0;"><strong>Delivery fee:</strong> ${deliveryFee > 0 ? `₦${deliveryFee.toLocaleString('en-NG')}` : 'FREE'}</p>
              <p style="margin: 0;"><strong>Total:</strong> ₦${total.toLocaleString('en-NG')}</p>
            </div>
            <div style="margin-top: 16px;">
              <a href="${appBase}/order?orderId=${encodeURIComponent(String(data.orderId || ''))}" style="display: inline-block; background: #7f1d1d; color: #fff; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-weight: 700;">
                View Order
              </a>
            </div>
          </div>
        </div>
      `

      return this.sendEmail({
        to: data.to,
        subject: `${data.statusLabel} - Order #${shortOrderId}`,
        html,
      })
    } catch (error) {
      console.error('[emailService.sendOrderStatusUpdateEmail] Failed:', error)
      return false
    }
  }

  private async sendCustomerOrderConfirmation(orderData: OrderEmailData): Promise<boolean> {
    const deliveryEstimate = orderData.deliveryEstimate || this.calculateDeliveryEstimate()
    const orderDate = orderData.orderDate || new Date()
    const accent = '#7f1d1d'
    const appBase = this.getAppBaseUrl()
    const logoUrl = `${appBase}/images/logo2.png`
    
    const itemsList = orderData.items.map(item => {
      const imageUrl = this.getOrderItemImageUrl(item)
      return `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.22);">
        <td style="padding: 12px; text-align: left; width: 80px;">
          <img src="${imageUrl}" alt="${item.title}" 
               style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.08);">
        </td>
        <td style="padding: 12px; text-align: left;">
          <div style="font-weight: 600; color: #ffffff; margin-bottom: 4px;">${item.title}</div>
          <div style="font-size: 12px; color: rgba(255,255,255,0.86);">SKU: ${item.sku || 'N/A'}</div>
          <div style="font-size: 12px; color: rgba(255,255,255,0.86);">Qty: ${item.quantity}</div>
        </td>
        <td style="padding: 12px; text-align: center; color: rgba(255,255,255,0.9);">₦${item.price.toLocaleString()}</td>
        <td style="padding: 12px; text-align: right; font-weight: 600; color: #ffffff;">₦${(item.price * item.quantity).toLocaleString()}</td>
      </tr>
    `
    }).join('')

    const computedProductSubtotal = orderData.items.reduce((sum, item) => {
      const qty = Number(item?.quantity || 0)
      const unitPrice = Number(item?.price || 0)
      return sum + (Number.isFinite(qty) ? qty : 0) * (Number.isFinite(unitPrice) ? unitPrice : 0)
    }, 0)
    const subtotal = Number.isFinite(Number(orderData.productSubtotal))
      ? Number(orderData.productSubtotal)
      : computedProductSubtotal
    const deliveryFee: number = Number.isFinite(Number(orderData.deliveryFee))
      ? Number(orderData.deliveryFee)
      : Math.max(0, Number(orderData.total || 0) - subtotal)
    const total = subtotal + deliveryFee

    const customerEmailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 640px; margin: 0 auto; background: ${accent}; color: #ffffff; border-radius: 14px; overflow: hidden;">
        <div style="padding: 26px 22px; text-align: center; background: rgba(0,0,0,0.12); border-bottom: 1px solid rgba(255,255,255,0.18);">
          <div style="display: inline-block; background: #ffffff; border-radius: 12px; padding: 10px 14px; margin: 0 auto 12px auto;">
            <img src="${logoUrl}" alt="Make It Sell" style="height: 40px; width: auto; display: block;" />
          </div>
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; letter-spacing: 0.6px;">INVOICE</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 15px;">Order Confirmation</p>
        </div>

        <div style="padding: 22px;">
          <table style="width: 100%; border-collapse: separate; border-spacing: 0;">
            <tr>
              <td style="width: 50%; vertical-align: top; padding-right: 10px;">
                <h2 style="margin: 0 0 10px 0; color: #ffffff; font-size: 20px;">Make It Sell</h2>
                <div style="color: rgba(255,255,255,0.92); font-size: 14px; line-height: 1.5;">
                  Lagos, Nigeria<br>
                  support@makeitsell.ng
                </div>
              </td>
              <td style="width: 50%; vertical-align: top; text-align: right; padding-left: 10px;">
                <div style="background: rgba(255,255,255,0.12); padding: 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.2);">
                  <div style="font-size: 13px; color: rgba(255,255,255,0.85); margin-bottom: 5px;">Invoice Number</div>
                  <div style="font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 10px;">#${orderData.orderId.substring(0, 8).toUpperCase()}</div>
                  <div style="font-size: 13px; color: rgba(255,255,255,0.85); margin-bottom: 4px;">Order Date</div>
                  <div style="font-size: 14px; color: #ffffff;">${orderDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                </div>
              </td>
            </tr>
          </table>

          <div style="margin-top: 18px; background: rgba(255,255,255,0.1); border-radius: 10px; border: 1px solid rgba(255,255,255,0.18); padding: 16px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="width: 50%; vertical-align: top; padding-right: 10px;">
                  <h3 style="margin: 0 0 10px 0; color: #ffffff; font-size: 16px;">Bill To:</h3>
                  <div style="color: rgba(255,255,255,0.95); font-size: 14px; line-height: 1.6;">
                    <div style="font-weight: 700; margin-bottom: 6px;">${orderData.customerName}</div>
                    <div>${orderData.shippingAddress.address}</div>
                    <div>${orderData.shippingAddress.city}, ${orderData.shippingAddress.state}</div>
                    <div>${orderData.shippingAddress.zipCode}</div>
                    <div>${orderData.shippingAddress.country}</div>
                    <div style="margin-top: 8px; color: rgba(255,255,255,0.88);">${orderData.customerEmail}</div>
                  </div>
                </td>
                <td style="width: 50%; vertical-align: top; padding-left: 10px;">
                  <h3 style="margin: 0 0 10px 0; color: #ffffff; font-size: 16px;">Sold By:</h3>
                  <div style="color: rgba(255,255,255,0.95); font-size: 14px; line-height: 1.6;">
                    <div style="font-weight: 700; margin-bottom: 6px;">${orderData.vendorName}</div>
                    <div>Make It Sell Vendor</div>
                  </div>
                </td>
              </tr>
            </table>
          </div>

          <div style="margin-top: 18px; background: rgba(255,255,255,0.08); border-radius: 10px; border: 1px solid rgba(255,255,255,0.18); padding: 16px;">
            <h3 style="margin: 0 0 14px 0; color: #ffffff; font-size: 20px;">Order Items</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: rgba(255,255,255,0.15);">
                  <th style="padding: 12px 10px; text-align: left; font-size: 13px; font-weight: 700; color: #ffffff;">Product</th>
                  <th style="padding: 12px 10px; text-align: left; font-size: 13px; font-weight: 700; color: #ffffff;">Description</th>
                  <th style="padding: 12px 10px; text-align: center; font-size: 13px; font-weight: 700; color: #ffffff;">Unit Price</th>
                  <th style="padding: 12px 10px; text-align: right; font-size: 13px; font-weight: 700; color: #ffffff;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsList}
                <tr>
                  <td colspan="4" style="padding: 0;"><div style="border-bottom: 1px solid rgba(255,255,255,0.25);"></div></td>
                </tr>
                <tr>
                  <td colspan="3" style="padding: 14px 10px; text-align: right; font-size: 14px; color: rgba(255,255,255,0.88);">Subtotal:</td>
                  <td style="padding: 14px 10px; text-align: right; font-size: 14px; font-weight: 700; color: #ffffff;">₦${subtotal.toLocaleString()}</td>
                </tr>
                <tr>
                  <td colspan="3" style="padding: 10px; text-align: right; font-size: 14px; color: rgba(255,255,255,0.88);">Delivery Fee:</td>
                  <td style="padding: 10px; text-align: right; font-size: 14px; font-weight: 700; color: #ffffff;">${deliveryFee === 0 ? 'FREE' : '₦' + deliveryFee.toLocaleString()}</td>
                </tr>
                <tr style="border-top: 1px solid rgba(255,255,255,0.3);">
                  <td colspan="3" style="padding: 14px 10px; text-align: right; font-size: 17px; font-weight: 700; color: #ffffff;">Total Amount:</td>
                  <td style="padding: 14px 10px; text-align: right; font-size: 20px; font-weight: 800; color: #ffffff;">₦${total.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style="margin-top: 18px; background: rgba(255,255,255,0.1); border-radius: 10px; border: 1px solid rgba(255,255,255,0.18); padding: 16px;">
            <h3 style="margin: 0 0 12px 0; color: #ffffff; font-size: 17px;">Delivery Information</h3>
            <p style="margin: 0 0 8px 0; color: rgba(255,255,255,0.92); font-size: 14px;">
              Estimated delivery: <strong style="color: #ffffff;">${deliveryEstimate.min === deliveryEstimate.max 
                ? `${deliveryEstimate.min} day${deliveryEstimate.min > 1 ? 's' : ''}` 
                : `${deliveryEstimate.min}-${deliveryEstimate.max} days`}</strong>
            </p>
            <p style="margin: 0; color: rgba(255,255,255,0.92); font-size: 14px; line-height: 1.5;">
              ${orderData.shippingAddress.firstName} ${orderData.shippingAddress.lastName}<br>
              ${orderData.shippingAddress.address}<br>
              ${orderData.shippingAddress.city}, ${orderData.shippingAddress.state}<br>
              ${orderData.shippingAddress.zipCode}, ${orderData.shippingAddress.country}
              ${orderData.shippingAddress.phone ? `<br>Phone: ${orderData.shippingAddress.phone}` : ''}
            </p>
          </div>

          <div style="text-align: center; margin-top: 22px;">
            <a href="mailto:support@makeitsell.ng" style="display: inline-block; background: #ffffff; color: ${accent}; text-decoration: none; padding: 11px 20px; border-radius: 8px; font-size: 14px; font-weight: 700; margin-right: 8px;">
              Contact Support
            </a>
            <a href="${appBase}/order?orderId=${orderData.orderId}" style="display: inline-block; background: transparent; color: #ffffff; text-decoration: none; padding: 11px 20px; border-radius: 8px; font-size: 14px; font-weight: 700; border: 1px solid rgba(255,255,255,0.7);">
              Track Order
            </a>
          </div>

          <div style="margin-top: 18px; text-align: center; color: rgba(255,255,255,0.85); font-size: 12px; border-top: 1px solid rgba(255,255,255,0.24); padding-top: 12px;">
            <p style="margin: 0;">Make It Sell - Lagos, Nigeria</p>
            <p style="margin: 4px 0 0 0;">This is an automated email. Please do not reply to this email.</p>
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
    
    const itemsList = orderData.items.map(item => {
      const imageUrl = this.getOrderItemImageUrl(item)
      return `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px; text-align: left;">
          <img src="${imageUrl}" alt="${item.title}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid #ececec;">
        </td>
        <td style="padding: 12px; text-align: left;">
          <strong>${item.title}</strong><br>
          <small style="color: #666;">SKU: ${item.sku || 'N/A'}</small><br>
          <small style="color: #666;">Qty: ${item.quantity}</small>
        </td>
        <td style="padding: 12px; text-align: right;">₦${(item.price * item.quantity).toLocaleString()}</td>
      </tr>
    `
    }).join('')

    const vendorOrdersUrl = this.getVendorOrdersUrl()
    const logoUrl = `${this.getAppBaseUrl()}/images/logo2.png`

    const computedProductSubtotal = orderData.items.reduce((sum, item) => {
      const qty = Number(item?.quantity || 0)
      const unitPrice = Number(item?.price || 0)
      return sum + (Number.isFinite(qty) ? qty : 0) * (Number.isFinite(unitPrice) ? unitPrice : 0)
    }, 0)
    const productSubtotal = Number.isFinite(Number(orderData.productSubtotal))
      ? Number(orderData.productSubtotal)
      : computedProductSubtotal
    const deliveryFee = Number.isFinite(Number(orderData.deliveryFee))
      ? Number(orderData.deliveryFee)
      : Math.max(0, Number(orderData.total || 0) - productSubtotal)

    const shortOrderId = orderData.orderId.substring(0, 8).toUpperCase();
    const vendorEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f7f7f8; border: 1px solid #ececf0; border-radius: 14px; overflow: hidden;">
        <div style="background: #7f1d1d; padding: 24px 20px; text-align: center;">
          <img src="${logoUrl}" alt="Make It Sell" style="height: 40px; width: auto; margin: 0 auto 12px auto; display: block;" />
          <h1 style="color: white; margin: 0; font-size: 26px; line-height: 1.2;">New Order Received</h1>
          <p style="color: rgba(255,255,255,0.92); margin: 8px 0 0 0;">You have a new order to process</p>
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

          <div style="background: #f8f9fa; border: 1px solid #ececec; border-radius: 8px; padding: 12px; margin: 14px 0 18px 0;">
            <p style="margin: 0 0 6px 0; color: #333;"><strong>Order ID:</strong> ${shortOrderId}</p>
            <p style="margin: 0 0 6px 0; color: #333;"><strong>Product subtotal:</strong> ₦${productSubtotal.toLocaleString()}</p>
            <p style="margin: 0; color: #333;"><strong>Delivery fee:</strong> ${deliveryFee > 0 ? `₦${deliveryFee.toLocaleString()}` : 'FREE'}</p>
          </div>
          
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
            <a href="${vendorOrdersUrl}" 
               style="background: #7f1d1d; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">
              View Order in Dashboard
            </a>
            <p style="margin: 10px 0 0 0; color: #666; font-size: 12px;">If you are logged out, this link takes you to login first, then opens your orders page.</p>
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
          <a href="${this.getAppBaseUrl()}/vendor/dashboard" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 12px 25px; border-radius: 6px; font-weight: 600;">Go to Dashboard</a>
        </div>

        <hr style="border: none; height: 1px; background-color: #eee; margin: 30px 0;">
        
        <div style="text-align: center; color: #666; font-size: 14px;">
          <p style="margin: 0 0 10px 0;">Thank you for choosing Make It Sell!</p>
          <p style="margin: 0;">Questions? Contact us at <a href="mailto:support@makeitsell.ng" style="color: #667eea;">support@makeitsell.ng</a></p>
        </div>
      </div>
    `

    return await this.sendEmail({
      to,
      subject,
      html: emailHtml
    })
  }

  async sendPasswordResetEmail({ email, name, resetCode, resetUrl, resetToken }: {
    email: string
    name: string
    resetCode?: string
    resetUrl?: string
    resetToken?: string
  }): Promise<boolean> {
    console.log('[emailService] Sending password reset email to:', email)
    console.log('[emailService] Reset code:', resetCode)
    console.log('[emailService] Reset URL:', resetUrl)

    const displayCode = (resetCode || resetToken || '').replace(/\D/g, '').slice(0, 6)
    const hasCode = displayCode.length === 6

    const safeName = this.escapeHtml(name || 'there')
    const supportEmail = process.env.SUPPORT_EMAIL || 'support@makeitsell.ng'

    const minimalHtml = hasCode
      ? `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111; line-height: 1.5;">
          <p>Hi ${safeName},</p>
          <p>Your Make It Sell password reset code is:</p>
          <p style="font-size: 30px; letter-spacing: 8px; font-weight: 700; margin: 16px 0;">${displayCode}</p>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this, you can ignore this email.</p>
          <p>Make It Sell Support<br/><a href="mailto:${supportEmail}">${supportEmail}</a></p>
        </div>
      `
      : `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111; line-height: 1.5;">
          <p>Hi ${safeName},</p>
          <p>Please reset your password for your Make It Sell account.</p>
          <p style="margin: 16px 0;">
            <a href="${resetUrl || '#'}">Reset password</a>
          </p>
          <p>This link may expire soon for your security.</p>
          <p>If you didn't request this, you can ignore this email.</p>
          <p>Make It Sell Support<br/><a href="mailto:${supportEmail}">${supportEmail}</a></p>
        </div>
      `

    const minimalText = hasCode
      ? [
          `Hi ${name || 'there'},`,
          '',
          'Your Make It Sell password reset code is:',
          displayCode,
          '',
          'This code will expire in 10 minutes.',
          '',
          "If you didn't request this, you can ignore this email.",
          '',
          `Make It Sell Support (${supportEmail})`,
        ].join('\n')
      : [
          `Hi ${name || 'there'},`,
          '',
          'Please reset your password for your Make It Sell account.',
          resetUrl ? `Reset link: ${resetUrl}` : '',
          '',
          "If you didn't request this, you can ignore this email.",
          '',
          `Make It Sell Support (${supportEmail})`,
        ].filter(Boolean).join('\n')

    return await this.sendEmail({
      to: email,
      subject: hasCode ? 'Your Make It Sell password reset code' : 'Reset your password - Make It Sell',
      html: minimalHtml,
      text: minimalText,
      replyTo: supportEmail,
    })
  }

  async sendEmailVerification({ email, name, verificationCode, verificationUrl }: {
    email: string
    name: string
    verificationCode?: string
    verificationUrl?: string
  }): Promise<boolean> {
    console.log('[emailService] Sending verification email to:', email)
    console.log('[emailService] Verification code:', verificationCode)
    console.log('[emailService] Verification URL:', verificationUrl)
    console.log('[emailService] SMTP Config:', {
      host: process.env.EMAIL_HOST || process.env.SMTP_HOST,
      port: process.env.EMAIL_PORT || process.env.SMTP_PORT,
      user: process.env.EMAIL_USER || process.env.SMTP_USER,
      from: this.getFromAddress()
    })
    
    const displayCode = (verificationCode || '').replace(/\D/g, '').slice(0, 6)
    const hasCode = displayCode.length === 6

    const safeName = this.escapeHtml(name || 'there')
    const supportEmail = process.env.SUPPORT_EMAIL || 'support@makeitsell.ng'
    const minimalHtml = hasCode
      ? `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111; line-height: 1.5;">
          <p>Hi ${safeName},</p>
          <p>Your Make It Sell verification code is:</p>
          <p style="font-size: 30px; letter-spacing: 8px; font-weight: 700; margin: 16px 0;">${displayCode}</p>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn\'t request this, you can ignore this email.</p>
          <p>Make It Sell Support<br/><a href="mailto:${supportEmail}">${supportEmail}</a></p>
        </div>
      `
      : `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111; line-height: 1.5;">
          <p>Hi ${safeName},</p>
          <p>Please verify your email address for your Make It Sell account.</p>
          <p style="margin: 16px 0;">
            <a href="${verificationUrl || '#'}">Verify email address</a>
          </p>
          <p>If you didn\'t request this, you can ignore this email.</p>
          <p>Make It Sell Support<br/><a href="mailto:${supportEmail}">${supportEmail}</a></p>
        </div>
      `

    const minimalText = hasCode
      ? [
          `Hi ${name || 'there'},`,
          '',
          'Your Make It Sell verification code is:',
          displayCode,
          '',
          'This code will expire in 10 minutes.',
          '',
          "If you didn't request this, you can ignore this email.",
          '',
          `Make It Sell Support (${supportEmail})`,
        ].join('\n')
      : [
          `Hi ${name || 'there'},`,
          '',
          'Please verify your email address for your Make It Sell account.',
          verificationUrl ? `Verification link: ${verificationUrl}` : '',
          '',
          "If you didn't request this, you can ignore this email.",
          '',
          `Make It Sell Support (${supportEmail})`,
        ].filter(Boolean).join('\n')

    return await this.sendEmail({
      to: email,
      subject: hasCode ? 'Verify your email - Make It Sell' : 'Verify your email address - Make It Sell',
      html: minimalHtml,
      text: minimalText,
      replyTo: supportEmail,
    })
  }

  getRegistrationIssueAnnouncementTemplate({
    name,
    overrides,
  }: {
    name?: string
    overrides?: RegistrationIssueTemplateOverrides
  }): {
    subject: string
    html: string
    text: string
  } {
    const posterToken = '{{poster}}'
    const signatureToken = '{{signature}}'
    const appBase = this.getAppBaseUrl()
    const logoUrl = 'https://www.makeitsell.ng/images/logo%20(2).png'
    const instagramUrl = 'https://www.instagram.com/makeitsell.ng/?__pwa=1'
    const twitterUrl = 'https://x.com/makeitsellorg'
    const instagramIconUrl = 'https://img.icons8.com/ios-filled/50/5b2f21/instagram-new.png'
    const twitterIconUrl = 'https://img.icons8.com/ios-filled/50/5b2f21/twitterx--v1.png'
    const facebookIconUrl = 'https://img.icons8.com/ios-filled/50/9ca3af/facebook-new.png'
    const safeName = this.escapeHtml(name || 'there')
    const subject = (overrides?.subject || 'Important: registration link issue update').trim()
    const headerTitle = this.escapeHtml((overrides?.headerTitle || 'Important update from Make It Sell').trim())
    const headerSubtitle = this.escapeHtml((overrides?.headerSubtitle || 'Registration link delivery issue').trim())
    const posterImageUrl = this.escapeHtml((overrides?.posterImageUrl || '').trim())
    const posterWidthPx = this.clampNumber(overrides?.posterWidthPx, 240, 620, 420)
    const posterHeightPx = this.clampNumber(overrides?.posterHeightPx, 140, 520, 220)
    const posterXOffsetPx = this.clampNumber(overrides?.posterXOffsetPx, 0, 120, 0)
    const posterYOffsetPx = this.clampNumber(overrides?.posterYOffsetPx, 0, 180, 0)
    const loginButtonText = this.escapeHtml((overrides?.loginButtonText || 'Sign in').trim())
    const signupButtonText = this.escapeHtml((overrides?.signupButtonText || 'Create account').trim())
    const eSignatureText = this.escapeHtml((overrides?.eSignatureText || '').trim())
    const signatureImageUrl = this.escapeHtml((overrides?.signatureImageUrl || '').trim())
    const senderName = this.escapeHtml((overrides?.senderName || 'Make It Sell Team').trim())
    const senderTitle = this.escapeHtml((overrides?.senderTitle || '').trim())
    const senderCompany = this.escapeHtml((overrides?.senderCompany || 'Make It Sell').trim())
    const signatureWidthPx = this.clampNumber(overrides?.signatureWidthPx, 80, 340, 180)
    const signatureHeightPx = this.clampNumber(overrides?.signatureHeightPx, 24, 120, 56)
    const signatureXOffsetPx = this.clampNumber(overrides?.signatureXOffsetPx, 0, 420, 0)
    const signatureYOffsetPx = this.clampNumber(overrides?.signatureYOffsetPx, 0, 220, 0)

    const defaultBody = [
      'Some users recently experienced delays or failures receiving registration and verification links. We sincerely apologize for the inconvenience.',
      'The issue has been fixed. If you were affected, please try signing in again or request a new verification link.',
      'If you still do not receive your link, contact us and we will assist immediately.',
    ].join('\n\n')

    const bodySource = (overrides?.body || defaultBody).trim()
    const bodyParagraphs = bodySource
      .split(/\r?\n\s*\r?\n/)
      .map(p => p.trim())
      .filter(Boolean)

    const signatureVisualHtml = signatureImageUrl
      ? `<img src="${signatureImageUrl}" alt="Signature" style="max-width: ${signatureWidthPx}px; max-height: ${signatureHeightPx}px; width: auto; height: auto; object-fit: contain; display: block; margin-bottom: 8px;" />`
      : ''

    const eSignatureHtml = eSignatureText
      ? `<div style="font-family: 'Brush Script MT', 'Segoe Script', cursive; font-size: 22px; line-height: 1.1; color: #161616; margin-bottom: 4px;">${eSignatureText}</div>`
      : ''

    const senderMetaHtml = [senderTitle, senderCompany]
      .filter(Boolean)
      .map(line => `<div>${line}</div>`)
      .join('')

    const hasSignatureBlock = !!(signatureImageUrl || eSignatureText)
    const tokenFoundInBody = bodySource.includes(signatureToken)
    const signatureStageHeight = Math.max(96, signatureYOffsetPx + 96)
    const signatureInlineWidthPx = this.clampNumber(signatureWidthPx, 90, 220, 150)
    const signatureInlineHeightPx = this.clampNumber(signatureHeightPx, 24, 72, 48)
    const signatureInlineOffsetPx = this.clampNumber(signatureXOffsetPx - 12, -24, 120, -12)

    const signaturePlacementHtml = hasSignatureBlock
      ? `
        <div style="position: relative; margin: 12px 0 6px 0; height: ${signatureStageHeight}px; max-width: 520px; overflow: hidden;">
          <div style="position: absolute; left: ${signatureXOffsetPx}px; top: ${signatureYOffsetPx}px; width: ${signatureWidthPx}px;">
            ${signatureVisualHtml}
            ${eSignatureHtml}
          </div>
        </div>
      `
      : ''

    const signatureInlineHtml = hasSignatureBlock
      ? `
        <div style="margin: 8px 0 8px ${signatureInlineOffsetPx}px; text-align: left;">
          ${signatureImageUrl ? `<img src="${signatureImageUrl}" alt="Signature" style="width: ${signatureInlineWidthPx}px; max-width: ${signatureInlineWidthPx}px; max-height: ${signatureInlineHeightPx}px; width: auto; height: auto; object-fit: contain; display: block; margin: 0 0 4px 0;" />` : ''}
          ${eSignatureHtml}
        </div>
      `
      : ''

    const hasPoster = !!posterImageUrl
    const posterInlineHtml = hasPoster
      ? `
        <div style="margin: ${12 + posterYOffsetPx}px 0 12px 0; text-align: center;">
          <img src="${posterImageUrl}" alt="Poster" style="display: inline-block; width: ${posterWidthPx}px; max-width: 100%; height: ${posterHeightPx}px; object-fit: contain; border-radius: 8px; background: #ffffff; margin-left: ${posterXOffsetPx}px;" />
        </div>
      `
      : ''

    const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const tokenSplitter = new RegExp(`(${escapeRegExp(signatureToken)}|${escapeRegExp(posterToken)})`)

    const htmlBodyParts: string[] = []
    for (const paragraph of bodyParagraphs) {
      const chunks = paragraph.split(tokenSplitter).filter(Boolean)
      for (const chunk of chunks) {
        if (chunk === signatureToken) {
          if (signatureInlineHtml) htmlBodyParts.push(signatureInlineHtml)
          continue
        }
        if (chunk === posterToken) {
          if (posterInlineHtml) htmlBodyParts.push(posterInlineHtml)
          continue
        }
        if (chunk.trim()) {
          htmlBodyParts.push(`<p style="margin: 0 0 10px 0; color: #1f2937 !important;">${this.escapeHtml(chunk)}</p>`)
        }
      }
    }
    const htmlBody = htmlBodyParts.join('')

    const showExternalSignatureBlock = hasSignatureBlock && !tokenFoundInBody
    const showSenderMetaBlock = !tokenFoundInBody
    const brandAccent = '#5b2f21'
    const brandAccentSoft = '#f8f3f1'

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff !important; color: #1f2937 !important; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; color-scheme: light; supported-color-schemes: light;">
        <div style="background: #ffffff !important; color: #1f2937 !important; padding: 18px 20px 14px 20px; border-bottom: 1px solid #e5e7eb;">
          <img src="${logoUrl}" alt="Make It Sell" style="height: 34px; width: auto; display: block; margin-bottom: 10px;" />
          <h1 style="margin: 0; font-size: 22px; color: #111827 !important;">${headerTitle}</h1>
          <p style="margin: 8px 0 0 0; color: #6b7280 !important;">${headerSubtitle}</p>
        </div>
        <div style="padding: 22px 20px; background: #ffffff !important; color: #1f2937 !important; line-height: 1.6;">
          <p style="margin-top: 0; color: #1f2937 !important;">Hi ${safeName},</p>
          ${htmlBody}
          <div style="margin: 22px 0; text-align: center;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto; border-collapse: separate; border-spacing: 10px 0;">
              <tr>
                <td bgcolor="${brandAccent}" style="border-radius: 10px;">
                  <a href="${appBase}/login" style="display: inline-block; padding: 12px 24px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.2; font-weight: 700; color: #ffffff !important; text-decoration: none !important; border-radius: 10px; border: 1px solid ${brandAccent};">${loginButtonText}</a>
                </td>
                <td bgcolor="${brandAccentSoft}" style="border-radius: 10px;">
                  <a href="${appBase}/signup" style="display: inline-block; padding: 12px 24px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.2; font-weight: 700; color: ${brandAccent} !important; text-decoration: none !important; border-radius: 10px; border: 1px solid ${brandAccent};">${signupButtonText}</a>
                </td>
              </tr>
            </table>
          </div>
          ${showExternalSignatureBlock ? signaturePlacementHtml : ''}
          ${showSenderMetaBlock ? `
            <div style="margin: 6px 0 16px 0; color: #222;">
              <div style="font-weight: 700;">${senderName}</div>
              <div style="color: #555; line-height: 1.4;">${senderMetaHtml}</div>
            </div>
          ` : ''}
          <p style="margin-bottom: 0; color: #1f2937 !important;"><a href="mailto:${process.env.SUPPORT_EMAIL || 'support@makeitsell.ng'}" style="color: ${brandAccent} !important; font-weight: 600; text-decoration: none;">${process.env.SUPPORT_EMAIL || 'support@makeitsell.ng'}</a></p>
          <div style="margin: 14px 0 2px 0; text-align: left;">
            <a href="${instagramUrl}" target="_blank" rel="noopener noreferrer" aria-label="Instagram" style="display: inline-block; text-decoration: none !important; margin-right: 10px; vertical-align: middle;">
              <img src="${instagramIconUrl}" alt="Instagram" width="20" height="20" style="display: block; width: 20px; height: 20px; border: 0;" />
            </a>
            <a href="${twitterUrl}" target="_blank" rel="noopener noreferrer" aria-label="X" style="display: inline-block; text-decoration: none !important; margin-right: 10px; vertical-align: middle;">
              <img src="${twitterIconUrl}" alt="X" width="20" height="20" style="display: block; width: 20px; height: 20px; border: 0;" />
            </a>
            <span aria-label="Facebook coming soon" style="display: inline-block; vertical-align: middle; opacity: 0.6;">
              <img src="${facebookIconUrl}" alt="Facebook" width="20" height="20" style="display: block; width: 20px; height: 20px; border: 0;" />
            </span>
          </div>
        </div>
      </div>
    `

    const tokenTextValue = hasSignatureBlock
      ? (overrides?.eSignatureText?.trim() || '[Signature]')
      : ''
    const posterTextValue = hasPoster ? '[Poster Image]' : ''

    const textBodySource = bodySource
      .split(signatureToken).join(tokenTextValue)
      .split(posterToken).join(posterTextValue)

    const textBodyParagraphs = textBodySource
      .split(/\r?\n\s*\r?\n/)
      .map(p => p.trim())
      .filter(Boolean)

    const text = [
      `Hi ${name || 'there'},`,
      '',
      ...textBodyParagraphs,
      '',
      `${overrides?.loginButtonText || 'Sign in'}: ${appBase}/login`,
      `${overrides?.signupButtonText || 'Create account'}: ${appBase}/signup`,
      ...(!tokenFoundInBody ? [
        '',
        `${overrides?.eSignatureText || ''}`,
        `${overrides?.senderName || 'Make It Sell Team'}`,
        `${overrides?.senderTitle || ''}`,
        `${overrides?.senderCompany || 'Make It Sell'}`,
        `${overrides?.signatureImageUrl ? `Signature image: ${overrides.signatureImageUrl}` : ''}`,
      ] : []),
      `Support: ${process.env.SUPPORT_EMAIL || 'support@makeitsell.ng'}`,
      `Instagram: ${instagramUrl}`,
      `X: ${twitterUrl}`,
      'Facebook: coming soon',
    ].filter(Boolean).join('\n')

    return { subject, html, text }
  }

  async sendRegistrationIssueAnnouncement({
    email,
    name,
    overrides,
  }: {
    email: string
    name?: string
    overrides?: RegistrationIssueTemplateOverrides
  }): Promise<boolean> {
    const appBase = this.getAppBaseUrl()
    const supportEmail = process.env.SUPPORT_EMAIL || 'support@makeitsell.ng'
    const safeName = this.escapeHtml(name || 'there')
    const subject = (overrides?.subject || 'Important update from Make It Sell').trim()
    const defaultBody = [
      'Some users recently experienced delays receiving registration and verification emails.',
      'The issue has been fixed. Please try signing in again or request a new verification code.',
      `If you still have issues, reply to this email or contact ${supportEmail}.`,
    ].join('\n\n')
    const body = (overrides?.body || defaultBody).trim()

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; color: #111827; background: #ffffff;">
        <h2 style="margin: 0 0 10px 0; font-size: 22px;">Important update from Make It Sell</h2>
        <p style="margin: 0 0 12px 0;">Hi ${safeName},</p>
        <p style="white-space: pre-line; margin: 0 0 16px 0; line-height: 1.6;">${this.escapeHtml(body)}</p>
        <p style="margin: 0 0 10px 0;">Sign in: <a href="${appBase}/login">${appBase}/login</a></p>
        <p style="margin: 0 0 10px 0;">Create account: <a href="${appBase}/signup">${appBase}/signup</a></p>
        <p style="margin: 0;">Support: <a href="mailto:${supportEmail}">${supportEmail}</a></p>
      </div>
    `

    const text = [
      `Hi ${name || 'there'},`,
      '',
      body,
      '',
      `Sign in: ${appBase}/login`,
      `Create account: ${appBase}/signup`,
      `Support: ${supportEmail}`,
    ].join('\n')

    return await this.sendEmail({
      to: email,
      subject,
      html,
      text,
      headers: {
        'X-Entity-Ref-ID': `registration-issue-${Date.now()}`,
      },
    })
  }
}

export const emailService = new EmailService()

// Export convenience functions
export const sendEmailByTemplate = async (to: string, subject: string, template: string, data: any) => {
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
