// src/app/(dashboard)/layout.tsx
// ─── Gerbang consent (UU PDP) ─────────────────────────────────────────────────
// Ini satu-satunya tempat yang bisa menegakkan persetujuan secara merata: setiap
// halaman yang butuh akun berada di dalam route group ini, dan sebuah layout
// berjalan sebelum halaman mana pun di bawahnya dirender.
//
// Kenapa di sini dan bukan di halaman pendaftaran: `<SignUp>` milik Clerk hanya
// menampilkan kotak centang persetujuan bila opsi itu dinyalakan di dashboard
// Clerk — sebuah langkah manual di luar repositori yang tidak bisa diuji, dan
// yang bila terlupa akan menghasilkan akun tanpa persetujuan tanpa satu pun
// tanda. Gerbang ini menegakkannya di kode: apa pun cara akun dibuat (form Clerk,
// Google OAuth, atau baris lama yang belum pernah menyetujui), dashboard tidak
// akan dirender sampai `consent_accepted_at` terisi.
//
// Konsekuensi yang disengaja: seluruh pengguna lama diminta menyetujui satu kali.
// Itu memang tujuannya — mereka belum pernah menyetujui kebijakan mana pun.
//
// Yang *tidak* dijaga di sini: route `/api/**` (layout tidak berlaku untuk route
// handler) dan halaman publik. Keduanya punya penjaganya sendiri.
import { redirect } from "next/navigation";
import { getCurrentUser, getSessionUserId } from "@/lib/currentUser";
import { hasAcceptedCurrentPolicy } from "@/lib/policy";
import { SiteFooter } from "@/components/layout/SiteFooter";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const userId = await getSessionUserId();

  // Deny-by-default: src/proxy.ts sudah menolak permintaan tanpa sesi, tetapi
  // sebuah layout tidak boleh bergantung pada satu lapisan saja.
  if (!userId) redirect("/sign-in");

  // The row is shared with the root layout through React `cache`, so resolving
  // `role` for the Navbar and `consentPolicyVersion` here costs one query, not two.
  const user = await getCurrentUser();

  // Baris yang belum ada diperlakukan sama dengan baris yang belum setuju: akun
  // baru yang webhook-nya belum jalan juga belum pernah menyetujui apa pun, dan
  // /api/consent/accept akan membuat barisnya saat pengguna menekan tombol.
  if (!user || !hasAcceptedCurrentPolicy(user.consentPolicyVersion)) {
    redirect("/consent");
  }

  return (
    <>
      {children}
      <SiteFooter />
    </>
  );
}
