// src/proxy.ts — Next.js 16 request proxy (formerly middleware)
// ─── First line of defense: authentication + deny-by-default routing ──────────
// This file answers only one question: "is there a session?".
// Role/ownership checks live in src/lib/authz.ts and run inside each route
// handler, right next to the data they protect.
//
// Everything is private unless listed in PUBLIC_ROUTES. Adding a public surface
// is therefore an explicit, reviewable decision rather than an accident.
//
// It also carries the two protections that have to happen *before* a handler
// runs and therefore cannot live in one:
//   • a CSRF guard on state-changing methods (src/lib/csrf.ts)
//   • the per-request Content-Security-Policy nonce (src/lib/securityHeaders.ts)
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse, type NextRequest } from 'next/server';
import { isCrossSiteRequest, requestOrigin } from './lib/csrf';
import { CSP_DIRECTIVES, CSP_REPORT_PATH } from './lib/securityHeaders';

const isPublicRoute = createRouteMatcher([
  '/',                  // landing page
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',  // authenticity is verified by the Svix signature in-handler
  // Uptime probe. Public on purpose: a monitor has no session. It returns only
  // coarse status codes and never any data, so there is nothing to leak here.
  '/api/health',
  // Browsers POST CSP violation reports without credentials, from the document
  // that was just blocked. The handler logs a bounded subset and stores nothing.
  '/api/csp-report',
]);

export default clerkMiddleware(
  async (auth, req) => {
    // ── CSRF ──────────────────────────────────────────────────────────────────
    // Ahead of the session check on purpose: a cross-site request is refused
    // whether or not it happens to carry a valid cookie.
    if (isCrossSiteRequest(req)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403, headers: { 'cache-control': 'no-store' } },
      );
    }

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
  },
  // ── Content-Security-Policy ─────────────────────────────────────────────────
  // Clerk mints the nonce, writes the header onto both the request and the
  // response, and exports `x-nonce` so server components can read it back
  // (see src/app/layout.tsx). Doing it here rather than in `next.config.ts` is
  // what makes it nonce-based: a nonce has to be fresh per request, and it is
  // Clerk's helper that knows which of its own hosts the policy must allow.
  //
  // `reportTo` needs an absolute URL — `Reporting-Endpoints` rejects relative
  // ones — so it is built from the request. `report-uri` is kept alongside it
  // for browsers that never shipped the Reporting API.
  (req: NextRequest) => {
    const reportUrl = `${requestOrigin(req)}${CSP_REPORT_PATH}`;
    return {
      contentSecurityPolicy: {
        strict: true,
        reportTo: reportUrl,
        directives: { ...CSP_DIRECTIVES, 'report-uri': [reportUrl] },
      },
    };
  },
);

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
