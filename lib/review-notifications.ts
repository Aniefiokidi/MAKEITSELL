// Additive vendor notification for a newly submitted review — none of the three review
// POST routes (app/api/{products,services,store}/.../reviews/route.ts) send any
// notification today (confirmed: none import push-notifications or email). This is called
// once, at the end of each route's POST handler, right after Review.create(...) — no
// changes to any route's eligibility/duplicate-check logic. Fire-and-forget throughout,
// matching lib/negotiation-service.ts's established shape, so a notification failure never
// affects the review-submission response.
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { pushToUser } from '@/lib/push-notifications'
import { emailService } from '@/lib/email'
import { resolveVendorWaId, sendWaNotification } from '@/lib/whatsapp/notify'

export function notifyReviewSubmitted(params: {
  targetType: 'product' | 'service' | 'store'
  vendorId: string
  rating: number
  comment: string
  reviewerName: string
}): void {
  const { targetType, vendorId, rating, comment, reviewerName } = params
  if (!vendorId) return

  const stars = '★'.repeat(Math.max(1, Math.min(5, Math.round(rating))))
  const excerpt = comment ? `: "${comment.slice(0, 120)}"` : ''
  const noun = targetType === 'store' ? 'your store' : `your ${targetType}`

  pushToUser(vendorId, {
    title: 'New Review',
    body: `${reviewerName} left a ${rating}★ review on ${noun}${excerpt}`,
    url: '/vendor/dashboard?tab=reviews',
    tag: `review-${targetType}-${vendorId}-${Date.now()}`,
  }).catch(() => {})

  ;(async () => {
    await connectToDatabase()
    const vendor: any = await User.findById(vendorId).select('email name').lean()
    if (!vendor?.email) return
    await emailService.sendEmail({
      to: vendor.email,
      subject: `New ${rating}★ review on ${noun}`,
      html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#ffffff">
  <div style="border-top:3px solid #e53e3e">
    <div style="background:#7b1c1c;padding:20px 32px">
      <h2 style="color:#ffffff;margin:0;font-size:18px">New Review — ${stars}</h2>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 16px;color:#2d3748">Hi ${vendor.name || 'there'},</p>
      <p style="color:#4a5568"><strong>${reviewerName}</strong> left a <strong>${rating}-star</strong> review on ${noun}.</p>
      ${comment ? `<div style="background:#f7fafc;border-left:4px solid #2b6cb0;padding:14px 18px;margin:16px 0;border-radius:0 6px 6px 0"><p style="margin:0;color:#4a5568;font-style:italic">"${comment}"</p></div>` : ''}
      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://makeitsell.ng'}/vendor/dashboard?tab=reviews" style="display:inline-block;background:#e53e3e;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px">View Review</a>
    </div>
  </div>
</div>`,
    })
  })().catch(() => {})

  resolveVendorWaId(vendorId).then((waId) =>
    sendWaNotification({
      waId,
      freeTextBody: `New ${rating}★ review on ${noun} from ${reviewerName}${excerpt}`,
      template: { name: 'vendor_review_received', params: [String(rating), reviewerName] },
    })
  ).catch(() => {})
}
