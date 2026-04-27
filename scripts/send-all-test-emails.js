import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
console.log('Loaded ENV:', Object.fromEntries(Object.entries(process.env).filter(([k]) => k.includes('EMAIL') || k.includes('SMTP') || k.includes('NODE_ENV'))));
console.log('Loaded ENV:', Object.fromEntries(Object.entries(process.env).filter(([k]) => k.includes('EMAIL') || k.includes('SMTP') || k.includes('NODE_ENV'))));
import { emailService } from '../lib/email'
import { sendWalletTopupEmail, sendWalletWithdrawalEmail } from '../lib/wallet-emails'
import { AppointmentEmailService } from '../lib/appointment-emails'

async function sendAllTestEmails(to) {
  // 1. Signup/Verification
  await emailService.sendEmailVerification({
    email: to,
    name: 'Test User',
    verificationCode: '123456',
    verificationUrl: 'https://www.makeitsell.ng/verify?code=123456',
  })

  // 2. Password Reset
  await emailService.sendPasswordResetEmail({
    email: to,
    name: 'Test User',
    resetCode: '654321',
    resetUrl: 'https://www.makeitsell.ng/reset?code=654321',
    resetToken: 'reset-token',
  })

  // 3. Booking Confirmation (Customer)
  await AppointmentEmailService.sendCustomerBookingConfirmation({
    bookingId: 'BKG123456',
    customerName: 'Test User',
    customerEmail: to,
    providerName: 'Provider Name',
    providerEmail: 'provider@example.com',
    serviceTitle: 'Test Service',
    bookingDate: new Date(),
    startTime: '10:00',
    endTime: '11:00',
    duration: 60,
    totalPrice: 5000,
    location: 'Test Location',
    locationType: 'in-person',
    status: 'confirmed',
  })

  // 4. Booking Confirmation (Provider)
  await AppointmentEmailService.sendProviderBookingNotification({
    bookingId: 'BKG123456',
    customerName: 'Test User',
    customerEmail: to,
    providerName: 'Provider Name',
    providerEmail: to,
    serviceTitle: 'Test Service',
    bookingDate: new Date(),
    startTime: '10:00',
    endTime: '11:00',
    duration: 60,
    totalPrice: 5000,
    location: 'Test Location',
    locationType: 'in-person',
    status: 'confirmed',
  })

  // 5. Wallet Top-Up
  await sendWalletTopupEmail({
    to,
    amount: 10000,
    reference: 'TOPUP123456',
    balance: 25000,
  })

  // 6. Wallet Withdrawal
  await sendWalletWithdrawalEmail({
    to,
    amount: 5000,
    reference: 'WD123456',
    balance: 20000,
  })
}

if (require.main === module) {
  const to = process.argv[2] || 'arnoldeee123@gmail.com'
  sendAllTestEmails(to).then(() => {
    console.log('All test emails sent to', to)
    process.exit(0)
  }).catch((err) => {
    console.error('Failed to send test emails:', err)
    process.exit(1)
  })
}
