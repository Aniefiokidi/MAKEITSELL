import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { requireAdminAccess } from '@/lib/server-route-auth'
import { hashPassword } from '@/lib/password'
import { emailService } from '@/lib/email'

function generateTemporaryPassword() {
  const raw = crypto.randomBytes(4).toString('hex').toUpperCase()
  return `MIS-${raw}`
}

function buildSecurityEmail(name: string, tempPassword: string, appUrl: string): string {
  const displayName = name || 'Valued Customer'
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:#8B0000;padding:28px 32px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">Make It Sell</h1>
          <p style="margin:6px 0 0;color:#ffcfcf;font-size:13px;">Security Update Notice</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;font-size:15px;color:#1a1a1a;">Hi <strong>${displayName}</strong>,</p>
          <p style="margin:0 0 16px;font-size:14px;color:#444;line-height:1.7;">
            As part of our ongoing commitment to platform security and quality assurance, we have completed a system-wide account security upgrade. As a precautionary measure, your account password has been temporarily reset.
          </p>
          <p style="margin:0 0 24px;font-size:14px;color:#444;line-height:1.7;">
            Please use the temporary password below to sign in and set a new password of your choice. This only takes a moment.
          </p>
          <!-- Temp password box -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td style="background:#f8f8f8;border:1.5px dashed #d0d0d0;border-radius:8px;padding:16px;text-align:center;">
              <p style="margin:0 0 6px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">Your Temporary Password</p>
              <p style="margin:0;font-size:26px;font-weight:700;letter-spacing:4px;color:#8B0000;font-family:monospace;">${tempPassword}</p>
            </td></tr>
          </table>
          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td align="center">
              <a href="${appUrl}/login" style="display:inline-block;background:#8B0000;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;">
                Sign In &amp; Set New Password
              </a>
            </td></tr>
          </table>
          <p style="margin:0 0 12px;font-size:13px;color:#666;line-height:1.7;">
            After signing in with the temporary password above, you will be prompted to create a new secure password for your account.
          </p>
          <p style="margin:0;font-size:13px;color:#888;line-height:1.7;">
            If you have any questions, please reply to this email or contact our support team. We apologise for any inconvenience caused.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f8f8f8;padding:20px 32px;text-align:center;border-top:1px solid #eee;">
          <p style="margin:0;font-size:12px;color:#aaa;">© Make It Sell · <a href="${appUrl}" style="color:#8B0000;text-decoration:none;">makeitsell.org</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim()
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminAccess(request)
  if (unauthorized) return unauthorized

  try {
    await connectToDatabase()

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://makeitsell.org'
    const adminNotifyEmail = process.env.ADMIN_BCC_EMAIL || 'arnoldeee123@gmail.com'

    // Get all users who still need to reset (mustChangePassword: true)
    const users = await User.find({ mustChangePassword: true })
      .select('_id email name displayName role passwordHash')
      .lean()

    if (users.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: 'No users pending password reset.' })
    }

    let sent = 0
    let failed = 0
    const errors: string[] = []

    for (const user of users as any[]) {
      try {
        const tempPassword = generateTemporaryPassword()
        const oldHash = String(user.passwordHash || '')

        await User.updateOne(
          { _id: user._id },
          {
            $set: {
              passwordHash: hashPassword(tempPassword),
              ...(oldHash ? { previousPasswordHash: oldHash } : {}),
              mustChangePassword: true,
              sessionToken: crypto.randomBytes(32).toString('hex'),
              temporaryPasswordIssuedAt: new Date(),
              updatedAt: new Date(),
            },
          }
        )

        const recipientName = user.name || user.displayName || ''
        const html = buildSecurityEmail(recipientName, tempPassword, appUrl)

        const ok = await emailService.sendEmail({
          to: user.email,
          subject: 'Important: Make It Sell Security Update — Action Required',
          html,
        })

        if (ok) {
          sent++
        } else {
          failed++
          errors.push(`${user.email}: email delivery failed`)
        }
      } catch (err: any) {
        failed++
        errors.push(`${user.email}: ${err?.message || 'unknown error'}`)
      }
    }

    // Also send admin account temp passwords to adminNotifyEmail
    const adminUsers = await User.find({ role: 'admin' })
      .select('_id email name displayName passwordHash')
      .lean()

    const adminSummary: Array<{ email: string; tempPassword: string }> = []

    for (const admin of adminUsers as any[]) {
      try {
        const tempPassword = generateTemporaryPassword()
        const oldHash = String(admin.passwordHash || '')

        await User.updateOne(
          { _id: admin._id },
          {
            $set: {
              passwordHash: hashPassword(tempPassword),
              ...(oldHash ? { previousPasswordHash: oldHash } : {}),
              mustChangePassword: true,
              sessionToken: crypto.randomBytes(32).toString('hex'),
              temporaryPasswordIssuedAt: new Date(),
              updatedAt: new Date(),
            },
          }
        )

        adminSummary.push({ email: admin.email, tempPassword })
      } catch (err: any) {
        errors.push(`admin ${admin.email}: ${err?.message || 'unknown error'}`)
      }
    }

    if (adminSummary.length > 0) {
      const adminHtml = `
        <p style="font-family:Arial,sans-serif;font-size:14px;color:#333;">
          Admin account temporary passwords (from security blast):
        </p>
        <table style="font-family:monospace;border-collapse:collapse;font-size:13px;">
          ${adminSummary.map(a => `
            <tr>
              <td style="padding:6px 16px 6px 0;color:#555;">${a.email}</td>
              <td style="padding:6px 0;font-weight:700;letter-spacing:2px;color:#8B0000;">${a.tempPassword}</td>
            </tr>
          `).join('')}
        </table>
      `
      await emailService.sendEmail({
        to: adminNotifyEmail,
        subject: 'MIS Admin — Temp Passwords from Security Blast',
        html: adminHtml,
      })
    }

    return NextResponse.json({
      success: true,
      total: users.length,
      sent,
      failed,
      errors: errors.slice(0, 20),
      adminAccountsReset: adminSummary.length,
      adminPasswordsSentTo: adminNotifyEmail,
    })
  } catch (error: any) {
    console.error('[security-blast-email]', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
