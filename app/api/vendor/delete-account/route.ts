import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { deleteUserAccount } from '@/lib/account-deletion'

// Thin wrapper around the shared deletion flow (lib/account-deletion.ts) — kept at this
// URL for the existing web vendor-settings UI. See app/api/account/delete for the
// canonical route (also used by the mobile app); both call the exact same function.
//
// This used to accept an admin-delete-any-vendor path (userId/vendorId taken from the
// request body). That capability is dropped here — it went through the same unsafe
// hard-delete logic this replaces, and a proper admin-initiated deletion flow (audit
// trail, different authorization shape) is out of scope for this change. This route is
// self-deletion only now, same as the buyer route.
export async function DELETE(request: NextRequest) {
  const sessionUser = await getSessionUserFromRequest(request)
  if (!sessionUser) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const result = await deleteUserAccount(sessionUser.id)

  if (result.status === 'not_found') {
    return NextResponse.json({ success: false, error: result.reason }, { status: 404 })
  }

  if (result.status === 'blocked') {
    return NextResponse.json(
      { success: false, error: result.reason, blockedBy: result.blockedBy },
      { status: 409 }
    )
  }

  return NextResponse.json({
    success: true,
    message: 'Account deleted successfully',
    alreadyDeleted: result.status === 'already_deleted',
  })
}
