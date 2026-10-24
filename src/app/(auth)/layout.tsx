// src/app/(auth)/layout.tsx
// ─── Footer untuk halaman masuk dan pendaftaran ──────────────────────────────
// Footer situs dulu dirender di layout akar untuk **semua** halaman; sekarang
// dirender per layout/halaman agar landing page bisa memakai footernya sendiri
// tanpa menumpuk dua footer (lihat `src/components/layout/SiteFooter.tsx`).
//
// Halaman di grup ini yang paling bergantung pada footer: tautan Kebijakan
// Privasi dan Ketentuan Layanan harus terbaca **sebelum** seseorang mendaftar —
// itulah alasan footer ini ada di tempat pertama.
import { SiteFooter } from "@/components/layout/SiteFooter";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SiteFooter />
    </>
  );
}
