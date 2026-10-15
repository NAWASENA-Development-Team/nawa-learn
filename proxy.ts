// proxy.ts — Next.js 16 request proxy (formerly middleware)
// ─── First line of defense: authentication + deny-by-default routing ──────────
// This file answers only one question: "is there a session?".
// Role/ownership checks live in src/lib/authz.ts and run inside each route
// handler, right next to the data they protect.
//
// Everything is private unless listed in PUBLIC_ROUTES. Adding a public surface
// is therefore an explicit, reviewable decision rather than an accident.
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',                  // landing page
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',  // authenticity is verified by the Svix signature in-handler
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  const { userId } = await auth();
  if (userId) return; // signed in → fine-grained checks happen in the route

  // Unauthenticated from here on.
  if (req.nextUrl.pathname.startsWith('/api')) {
    // Return JSON (not a redirect) so API clients get a predictable 401.
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Page request → Clerk redirects to sign-in.
  await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
