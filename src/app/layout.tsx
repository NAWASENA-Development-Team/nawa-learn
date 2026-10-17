// app/layout.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { Analytics } from "@vercel/analytics/next"
import Navbar from "@/components/layout/Navbar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NAWA-LEARN | SMAN 2 Jonggol",
  description: "Platform belajar kolaboratif OSIS NAWASENA SMAN 2 Jonggol",
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

  return (
    <ClerkProvider nonce={nonce}>
      {/* suppressHydrationWarning is required for next-themes to add the class without mismatch */}
      <html lang="id" suppressHydrationWarning>
        <body className={`${inter.className} min-h-screen flex flex-col`}>
          <ThemeProvider nonce={nonce}>
            <ToastProvider>
              <Navbar />
              <main className="flex-1 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
                {children}
              </main>
              <footer className="py-6 text-center text-sm text-zinc-400 dark:text-zinc-500 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                <p>
                  © {new Date().getFullYear()} OSIS NAWASENA SMAN 2 Jonggol. Developed by the ICT Division.
                </p>
                {/* Dokumen hukum harus bisa dibaca sebelum mendaftar, jadi
                    tautannya ada di footer yang tampil di setiap halaman —
                    termasuk halaman masuk dan halaman publik. */}
                <nav className="mt-2 flex items-center justify-center gap-4 text-xs font-semibold">
                  <Link href="/privacy" className="hover:text-indigo-600 hover:underline dark:hover:text-indigo-400">
                    Kebijakan Privasi
                  </Link>
                  <span aria-hidden className="text-zinc-300 dark:text-zinc-700">•</span>
                  <Link href="/terms" className="hover:text-indigo-600 hover:underline dark:hover:text-indigo-400">
                    Ketentuan Layanan
                  </Link>
                </nav>
              </footer>
            </ToastProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}