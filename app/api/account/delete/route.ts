import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromRequest } from '@/lib/server-route-auth'
import { deleteUserAccount } from '@/lib/account-deletion'

// The one canonical account-deletion endpoint — callable by both the website (cookie
// session) and the mobile app (Authorization: Bearer <token>), since
// getSessionUserFromRequest already accepts either. app/api/user/delete-account and
// app/api/vendor/delete-account are kept as thin wrappers around the same
// deleteUserAccount() call for backward compatibility with the existing web UI, not as
// a second implementation.
export async function POST(request: NextRequest) {
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

  // 'deleted' or 'already_deleted' — idempotent, both are success from the caller's
  // point of view.
  return NextResponse.json({
    success: true,
    alreadyDeleted: result.status === 'already_deleted',
  })
}
