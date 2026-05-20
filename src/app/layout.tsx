// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ToastProvider } from "@/components/ui/Toast";
import Navbar from "@/components/layout/Navbar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NAWA-LEARN | SMAN 2 Jonggol",
  description: "Platform belajar kolaboratif OSIS NAWASENA SMAN 2 Jonggol",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      {/* suppressHydrationWarning is required for next-themes to add the class without mismatch */}
      <html lang="id" suppressHydrationWarning>
        <body className={`${inter.className} min-h-screen flex flex-col`}>
          <ThemeProvider>
            <ToastProvider>
              <Navbar />
              <main className="flex-1 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
                {children}
              </main>
              <footer className="py-6 text-center text-sm text-zinc-400 dark:text-zinc-500 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                © {new Date().getFullYear()} OSIS NAWASENA SMAN 2 Jonggol. Developed by the ICT Division.
              </footer>
            </ToastProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}