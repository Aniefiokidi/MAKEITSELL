import { NextRequest, NextResponse } from 'next/server'
import { SITE_LOCK_COOKIE, isSiteLockEnabled, isValidUnlockCookie } from '@/lib/site-lock'

export async function middleware(request: NextRequest) {
  if (!isSiteLockEnabled()) {
    return NextResponse.next()
  }

  const unlockCookie = request.cookies.get(SITE_LOCK_COOKIE)?.value
  if (await isValidUnlockCookie(unlockCookie)) {
    return NextResponse.next()
  }

  const url = request.nextUrl.clone()
  url.pathname = '/coming-soon'
  url.searchParams.set('redirect', request.nextUrl.pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|coming-soon|favicon.ico|robots.txt|sitemap.xml|manifest.json|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf)$).*)',
  ],
}
