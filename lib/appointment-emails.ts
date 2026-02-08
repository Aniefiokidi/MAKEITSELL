import { emailService } from './email'

export interface AppointmentEmailData {
  bookingId: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  providerName: string
  providerEmail: string
  serviceTitle: string
  bookingDate: Date
  startTime: string
  endTime: string
  duration: number
  totalPrice: number
  location: string
  locationType: 'online' | 'in-person' | 'both'
  notes?: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
}

export const AppointmentEmailService = {
  // Send booking confirmation emails to both customer and provider
  async sendBookingConfirmationEmails(data: AppointmentEmailData): Promise<boolean> {
    try {
      console.log('[AppointmentEmailService] Sending booking confirmation emails...')
      
      // Send confirmation email to customer
      const customerEmailSent = await this.sendCustomerBookingConfirmation(data)
      
      // Send notification email to provider
      const providerEmailSent = await this.sendProviderBookingNotification(data)

      const success = customerEmailSent && providerEmailSent
      console.log(`[AppointmentEmailService] Emails sent - Customer: ${customerEmailSent ? '✅' : '❌'}, Provider: ${providerEmailSent ? '✅' : '❌'}`)
      
      return success
    } catch (error) {
      console.error('[AppointmentEmailService] Failed to send booking emails:', error)
      return false
    }
  },

  // Send booking confirmation email to customer
  async sendCustomerBookingConfirmation(data: AppointmentEmailData): Promise<boolean> {
    const bookingDate = new Date(data.bookingDate)
    const formattedDate = bookingDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
    
    const locationText = data.locationType === 'online' 
      ? 'Online Session' 
      : data.locationType === 'in-person' 
        ? data.location 
        : `${data.location} (Flexible)`

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">📅 Appointment Confirmed!</h1>
          <p style="color: white; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your booking has been successfully scheduled</p>
        </div>

        <!-- Greeting -->
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="color: #333; margin: 0 0 10px 0; font-size: 24px;">Hi ${data.customerName}!</h2>
          <p style="color: #666; margin: 0; font-size: 16px; line-height: 1.5;">
            Great news! Your appointment with <strong>${data.providerName}</strong> has been confirmed.
          </p>
        </div>

        <!-- Appointment Details -->
        <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; margin-bottom: 25px; border: 1px solid #e9ecef;">
          <h3 style="color: #333; margin: 0 0 15px 0; font-size: 20px; border-bottom: 2px solid #667eea; padding-bottom: 5px;">📋 Appointment Details</h3>
          
          <div style="display: grid; gap: 15px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 18px;">🔧</span>
              <div>
                <strong style="color: #333; font-size: 16px;">Service:</strong>
                <p style="margin: 2px 0 0 0; color: #667eea; font-weight: 600; font-size: 16px;">${data.serviceTitle}</p>
              </div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 18px;">📅</span>
              <div>
                <strong style="color: #333; font-size: 16px;">Date:</strong>
                <p style="margin: 2px 0 0 0; color: #333; font-size: 16px;">${formattedDate}</p>
              </div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 18px;">⏰</span>
              <div>
                <strong style="color: #333; font-size: 16px;">Time:</strong>
                <p style="margin: 2px 0 0 0; color: #333; font-size: 16px;">${data.startTime} - ${data.endTime} (${data.duration} minutes)</p>
              </div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 18px;">${data.locationType === 'online' ? '💻' : '📍'}</span>
              <div>
                <strong style="color: #333; font-size: 16px;">Location:</strong>
                <p style="margin: 2px 0 0 0; color: #333; font-size: 16px;">${locationText}</p>
              </div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 18px;">💰</span>
              <div>
                <strong style="color: #333; font-size: 16px;">Total:</strong>
                <p style="margin: 2px 0 0 0; color: #28a745; font-weight: 700; font-size: 18px;">₦${data.totalPrice.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        ${data.notes ? `
        <!-- Notes -->
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <h4 style="color: #856404; margin: 0 0 5px 0; font-size: 16px;">📝 Additional Notes:</h4>
          <p style="margin: 0; color: #856404; font-size: 14px;">${data.notes}</p>
        </div>
        ` : ''}

        <!-- Provider Contact -->
        <div style="background: #e7f3ff; padding: 20px; border-radius: 10px; margin-bottom: 25px; border-left: 4px solid #667eea;">
          <h3 style="color: #333; margin: 0 0 10px 0; font-size: 18px;">👨‍💼 Your Service Provider</h3>
          <p style="margin: 0; color: #333;"><strong>Name:</strong> ${data.providerName}</p>
          <p style="margin: 5px 0; color: #333;"><strong>Contact:</strong> ${data.providerEmail}</p>
          <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Feel free to reach out if you have any questions!</p>
        </div>

        <!-- Next Steps -->
        <div style="background: #d4edda; padding: 20px; border-radius: 10px; margin-bottom: 25px; border-left: 4px solid #28a745;">
          <h3 style="color: #155724; margin: 0 0 10px 0; font-size: 18px;">✅ What's Next?</h3>
          <ul style="margin: 0; padding-left: 20px; color: #155724; line-height: 1.6;">
            <li>Your provider will confirm the appointment shortly</li>
            <li>You'll receive a confirmation call if a phone number was provided</li>
            <li>Save this email for your records</li>
            <li>Prepare any questions you'd like to discuss during the session</li>
          </ul>
        </div>

        <!-- Support -->
        <div style="text-align: center; color: #666; font-size: 14px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="margin: 0 0 10px 0;">
            Need help or want to reschedule? Contact us!
          </p>
          <p style="margin: 0;">
            📧 <a href="mailto:support@makeitsell.com" style="color: #667eea; text-decoration: none; font-weight: 600;">support@makeitsell.com</a>
          </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="margin: 0;">
            This appointment confirmation was sent to ${data.customerEmail}. 
            <br>Booking ID: #${data.bookingId.substring(0, 8).toUpperCase()}
          </p>
        </div>
      </div>
    `

    return await emailService.sendEmail({
      to: data.customerEmail,
      subject: `🎉 Appointment Confirmed - ${data.serviceTitle} on ${formattedDate}`,
      html: emailHtml
    })
  },

  // Send booking notification email to provider/vendor
  async sendProviderBookingNotification(data: AppointmentEmailData): Promise<boolean> {
    const bookingDate = new Date(data.bookingDate)
    const formattedDate = bookingDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
    
    const locationText = data.locationType === 'online' 
      ? 'Online Session' 
      : data.locationType === 'in-person' 
        ? data.location 
        : `${data.location} (Flexible)`

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px; padding: 20px; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); border-radius: 10px;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">🎉 New Booking Received!</h1>
          <p style="color: white; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">You have a new appointment request</p>
        </div>

        <!-- Greeting -->
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="color: #333; margin: 0 0 10px 0; font-size: 24px;">Hi ${data.providerName}!</h2>
          <p style="color: #666; margin: 0; font-size: 16px; line-height: 1.5;">
            Great news! You have a new appointment booking for your service.
          </p>
        </div>

        <!-- Booking Details -->
        <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; margin-bottom: 25px; border: 1px solid #e9ecef;">
          <h3 style="color: #333; margin: 0 0 15px 0; font-size: 20px; border-bottom: 2px solid #28a745; padding-bottom: 5px;">📋 Booking Details</h3>
          
          <div style="display: grid; gap: 15px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 18px;">🔧</span>
              <div>
                <strong style="color: #333; font-size: 16px;">Service:</strong>
                <p style="margin: 2px 0 0 0; color: #28a745; font-weight: 600; font-size: 16px;">${data.serviceTitle}</p>
              </div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 18px;">📅</span>
              <div>
                <strong style="color: #333; font-size: 16px;">Date:</strong>
                <p style="margin: 2px 0 0 0; color: #333; font-size: 16px;">${formattedDate}</p>
              </div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 18px;">⏰</span>
              <div>
                <strong style="color: #333; font-size: 16px;">Time:</strong>
                <p style="margin: 2px 0 0 0; color: #333; font-size: 16px;">${data.startTime} - ${data.endTime} (${data.duration} minutes)</p>
              </div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 18px;">${data.locationType === 'online' ? '💻' : '📍'}</span>
              <div>
                <strong style="color: #333; font-size: 16px;">Location:</strong>
                <p style="margin: 2px 0 0 0; color: #333; font-size: 16px;">${locationText}</p>
              </div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 18px;">💰</span>
              <div>
                <strong style="color: #333; font-size: 16px;">Earnings:</strong>
                <p style="margin: 2px 0 0 0; color: #28a745; font-weight: 700; font-size: 18px;">₦${data.totalPrice.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Customer Information -->
        <div style="background: #e7f3ff; padding: 20px; border-radius: 10px; margin-bottom: 25px; border-left: 4px solid #1e90ff;">
          <h3 style="color: #333; margin: 0 0 10px 0; font-size: 18px;">👤 Customer Information</h3>
          <p style="margin: 0; color: #333;"><strong>Name:</strong> ${data.customerName}</p>
          <p style="margin: 5px 0; color: #333;"><strong>Email:</strong> ${data.customerEmail}</p>
          ${data.customerPhone ? `<p style="margin: 5px 0; color: #333;"><strong>Phone:</strong> ${data.customerPhone}</p>` : ''}
        </div>

        ${data.notes ? `
        <!-- Customer Notes -->
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <h4 style="color: #856404; margin: 0 0 5px 0; font-size: 16px;">📝 Customer Notes:</h4>
          <p style="margin: 0; color: #856404; font-size: 14px;">${data.notes}</p>
        </div>
        ` : ''}

        <!-- Action Required -->
        <div style="background: #fff3cd; padding: 20px; border-radius: 10px; margin-bottom: 25px; border-left: 4px solid #ffc107;">
          <h3 style="color: #856404; margin: 0 0 10px 0; font-size: 18px;">⚡ Action Required</h3>
          <ul style="margin: 0; padding-left: 20px; color: #856404; line-height: 1.6;">
            <li>Confirm or reschedule this appointment through your dashboard</li>
            <li>Contact the customer if you need additional information</li>
            <li>Prepare materials and resources for the session</li>
            <li>Add this appointment to your calendar</li>
          </ul>
        </div>

        <!-- Support -->
        <div style="text-align: center; color: #666; font-size: 14px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="margin: 0 0 10px 0;">
            Questions about this booking? Need help with your account?
          </p>
          <p style="margin: 0;">
            📧 <a href="mailto:support@makeitsell.com" style="color: #28a745; text-decoration: none; font-weight: 600;">support@makeitsell.com</a>
          </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="margin: 0;">
            This booking notification was sent to ${data.providerEmail}. 
            <br>Booking ID: #${data.bookingId.substring(0, 8).toUpperCase()}
          </p>
        </div>
      </div>
    `

    return await emailService.sendEmail({
      to: data.providerEmail,
      subject: `💰 New Booking: ${data.serviceTitle} - ${formattedDate} at ${data.startTime}`,
      html: emailHtml
    })
  }
}