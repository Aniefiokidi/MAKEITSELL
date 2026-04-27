import { emailService } from './email'

export async function sendWalletTopupEmail({ to, amount, reference, balance }: { to: string, amount: number, reference: string, balance: number }) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fff;">
      <h2 style="color: #28a745;">Wallet Top-Up Successful</h2>
      <p>Dear user,</p>
      <p>Your wallet has been credited with <strong>₦${amount.toLocaleString()}</strong>.</p>
      <p><strong>Reference:</strong> ${reference}</p>
      <p><strong>Current Balance:</strong> ₦${balance.toLocaleString()}</p>
      <p>Thank you for using Make It Sell!</p>
    </div>
  `
  return emailService.sendEmail({
    to,
    subject: 'Wallet Top-Up Successful',
    html
  })
}

export async function sendWalletWithdrawalEmail({ to, amount, reference, balance }: { to: string, amount: number, reference: string, balance: number }) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fff;">
      <h2 style="color: #7f1d1d;">Wallet Withdrawal Processed</h2>
      <p>Dear user,</p>
      <p>Your withdrawal request of <strong>₦${amount.toLocaleString()}</strong> has been processed.</p>
      <p><strong>Reference:</strong> ${reference}</p>
      <p><strong>Current Balance:</strong> ₦${balance.toLocaleString()}</p>
      <p>If you did not initiate this, please contact support immediately.</p>
      <p>Thank you for using Make It Sell!</p>
    </div>
  `
  return emailService.sendEmail({
    to,
    subject: 'Wallet Withdrawal Processed',
    html
  })
}
