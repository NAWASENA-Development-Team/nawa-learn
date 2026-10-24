// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";
import { getCurrentUser } from "@/lib/currentUser";
import { canReview } from "@/lib/authz";
import Navbar from "@/components/layout/Navbar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  // Makes every relative metadata URL absolute — `openGraph.url` below, and any
  // canonical a future page adds. Without it Next falls back to an origin derived
  // from the environment, which is right on Vercel and wrong everywhere else.
  // `SITE_URL` is already validated (see src/lib/site.ts), so this cannot throw.
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // No `title.template`. The six pages that set their own `metadata` already end
  // their titles with "| NAWA-LEARN SMAN 2 Jonggol", so a template of
  // "%s | NAWA-LEARN" would render "Ketentuan Layanan | NAWA-LEARN SMAN 2
  // Jonggol | NAWA-LEARN". The pages that set nothing (the dashboard) inherit
  // `SITE_TITLE` above, which is a plain, correct default.
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "id_ID",
    url: "/",
    // No `images` entry on purpose. An Open Graph image has to be a raster
    // (1200×630 PNG/JPEG); every social platform ignores an SVG. The only
    // artwork in the repo is a vector, so declaring one would produce a card with
    // a broken image — worse than the plain text card we get by omitting it.
  },
};

/**
 * `themeColor` lives here, not in `metadata`: Next 16 deprecated the metadata
 * form. The two media queries track the *operating system* scheme, because that
 * is all a `<meta>` tag can see — next-themes keeps the student's explicit
 * choice in `localStorage`, which the server cannot read. A student who forces
 * dark on a light OS therefore gets a light toolbar; the alternative is a single
 * colour that is wrong for whichever group is not the default.
 *
 * `colorScheme` is deliberately not declared: `ThemeProvider` sets
 * `enableSystem={false}` and drives the `.dark` class from its own state, so
 * promising the UA "light dark" would let it paint light form controls and
 * scrollbars inside a dark page.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The CSP nonce the proxy minted for this request. Two components need it
  // because both render a <script> into the HTML:
  //
  //   • ClerkProvider  → the clerk-js loader tag
  //   • ThemeProvider  → next-themes' pre-hydration theme script
  //
  // Under `strict-dynamic` a script tag in the document is only trusted if it
  // carries the nonce, so without this both are blocked and the app loses
  // sign-in and its theme.
  //
  // Reading `headers()` here also opts every route into dynamic rendering, which
  // is exactly what a nonce requires: a nonce cannot be baked into HTML that was
  // rendered at build time. That is why this is the root layout and not a
  // per-page concern.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  // Whether the "Moderator" nav item exists is decided here, on the server, from
  // `users.role`. It used to be a `fetch("/api/moderator/auth-check")` inside the
  // client Navbar: one extra HTTP request plus one database query on every page,
  // and the link popped in after hydration — a visible layout shift that also
  // told every visitor a hidden panel exists.
  //
  // `getCurrentUser()` is request-scoped (React `cache`), so the dashboard layout
  // below shares this same query rather than paying for a second one. Anonymous
  // visitors run no query at all.
  const currentUser = await getCurrentUser();
  const isModerator = currentUser ? canReview(currentUser) : false;

  return (
    <ClerkProvider nonce={nonce}>
      {/* suppressHydrationWarning is required for next-themes to add the class without mismatch */}
      <html lang="id" suppressHydrationWarning>
        <body className={`${inter.className} min-h-screen flex flex-col`}>
          <ThemeProvider nonce={nonce}>
            <ToastProvider>
              <Navbar isModerator={isModerator} />
              <main className="flex flex-1 flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
                {children}
              </main>
              {/* Footer situs ada di `SiteFooter`, dirender per layout/halaman —
                  bukan di sini. Layout akar tidak tahu rute mana yang sedang
                  dirender, padahal landing page memiliki footernya sendiri
                  (`LandingClient`) dan tidak boleh menumpuk dua footer.
                  `src/components/layout/SiteFooter.tsx` menjelaskan alasannya. */}
            </ToastProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}