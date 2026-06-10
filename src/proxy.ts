// proxy.ts — Next.js 16 request proxy (replaces middleware.ts)
// OPTIMISTIC route protection only: reads the session cookie and redirects.
// The real security boundary is verifySession() in src/lib/dal.ts —
// never rely on this proxy alone for authorization decisions.
import { NextRequest, NextResponse } from 'next/server'
import { decrypt } from '@/lib/session'

const protectedRoutes = ['/dashboard', '/reports', '/admin']
const publicRoutes = ['/login']

export default async function proxy(req: NextRequest): Promise<NextResponse> {
  const path = req.nextUrl.pathname
  const isProtected = protectedRoutes.some((r) => path.startsWith(r))
  const isPublic = publicRoutes.includes(path)

  // In proxy/middleware context, read cookies directly from the request
  // (not from cookies() API which is for Server Components/Actions)
  const cookie = req.cookies.get('session')?.value
  const session = await decrypt(cookie)

  if (isProtected && !session?.userId) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }
  if (isPublic && session?.userId) {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
