import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Pages reachable WITHOUT being logged in.
const PUBLIC_PATHS = ['/login', '/welcome']

export function middleware(request: NextRequest) {
  const token = request.cookies.get('laura_token')?.value
  const path = request.nextUrl.pathname
  // /design is the public design-build showcase (no real data behind it).
  const isPublic = PUBLIC_PATHS.includes(path) || path === '/design' || path.startsWith('/design/')

  // Not logged in and trying to reach a protected page -> go to login first.
  if (!token && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  // Logged in and sitting on /login -> go to welcome (the post-login showcase).
  if (token && path === '/login') {
    return NextResponse.redirect(new URL('/welcome', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
