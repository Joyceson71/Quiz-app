import { updateSession } from '@/lib/supabase/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { globalRateLimiter } from '@/lib/rate-limit';

export async function middleware(request: NextRequest) {
  // Apply rate limiting to API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    if (!globalRateLimiter.check(ip)) {
      return NextResponse.json(
        { error: 'Too many requests, please try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|sounds|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
