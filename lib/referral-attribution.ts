// Shared client-side helpers for the referral system's "any listing is a referral
// link" model — a signup or purchase after visiting a vendor's store/product page
// attributes to that vendor even with no ?ref= present, but ?ref= (when a vendor
// explicitly shares a tagged link) also logs a click for their referral dashboard.

export function setPendingReferralVendor(vendorId: string | null | undefined) {
  const trimmed = String(vendorId || '').trim()
  if (!trimmed) return
  try {
    localStorage.setItem('misReferralVendorId', trimmed)
  } catch {}
}

export function trackReferralClick(code: string | null | undefined) {
  const trimmed = String(code || '').trim().toUpperCase()
  if (!trimmed) return
  fetch('/api/referral/track-click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: trimmed }),
    keepalive: true,
  }).catch(() => {})
}
