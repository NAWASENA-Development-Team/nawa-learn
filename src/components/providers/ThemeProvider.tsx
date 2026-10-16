// src/components/providers/ThemeProvider.tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * `nonce` is forwarded to next-themes, which renders a pre-hydration inline
 * <script> to set the theme class before paint. Under the app's strict CSP that
 * script is only allowed if it carries the request's nonce (see
 * src/app/layout.tsx), so the prop is not optional in practice.
 */
export function ThemeProvider({
  children,
  nonce,
}: {
  children: ReactNode;
  nonce?: string;
}) {
  return (
    <NextThemesProvider
      attribute="class"      // Adds/removes .dark class on <html>
      defaultTheme="dark"
      enableSystem={false}
      nonce={nonce}
    >
      {children}
    </NextThemesProvider>
  );
}
