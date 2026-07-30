"use client"

// Retired — mustChangePassword no longer forces a redirect to /account/complete-setup.
// Login and the normal forgot-password flow are the only supported paths now; a user
// with mustChangePassword still set on their record (from the old temp-password admin
// tooling) just logs in and uses the app normally. Kept as an inert no-op rather than
// removed from GlobalClientProviders for a clean revert if ever needed.
export default function ForcePasswordChangeGate() {
  return null
}
