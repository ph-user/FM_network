import { NextResponse, type NextRequest } from 'next/server';

import { SESSION_COOKIE, verifySession } from '@/lib/session';

/**
 * Everything is behind the login except the login page itself. This is a first
 * gate for convenience and redirects, not the security boundary. Each API route
 * re-checks the session and the role for itself.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isLoginPage = pathname === '/login';
  const isAuthApi = pathname.startsWith('/api/auth/');

  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (isAuthApi) return NextResponse.next();

  if (session && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (!session && !isLoginPage) {
    const login = new URL('/login', request.url);
    // Send them back where they were headed once they're in. Path only, so a
    // crafted ?next= can't bounce anyone to another site.
    if (pathname !== '/') login.searchParams.set('next', pathname + search);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
