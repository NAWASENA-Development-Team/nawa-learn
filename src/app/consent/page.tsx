// src/app/consent/page.tsx
// ─── Layar persetujuan kebijakan (UU PDP) ─────────────────────────────────────
// Halaman ini hidup *di luar* route group `(dashboard)` dengan sengaja: gerbang di
// src/app/(dashboard)/layout.tsx mengarahkan ke sini, dan kalau halaman ini ikut
// dijaga oleh gerbang yang sama, pengguna akan terjebak dalam lingkaran
// pengalihan tanpa pernah bisa menyetujui apa pun.
//
// Halaman tetap privat (tidak ada di PUBLIC_ROUTES): hanya pengguna dengan sesi
// yang bisa sampai ke sini, karena yang dicatat adalah persetujuan atas sebuah
// akun.
import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hasAcceptedCurrentPolicy } from "@/lib/policy";
import ConsentForm from "@/components/legal/ConsentForm";
import { SiteFooter } from "@/components/layout/SiteFooter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Persetujuan Kebijakan | NAWA-LEARN SMAN 2 Jonggol",
  description:
    "Satu langkah sebelum memakai NAWA-LEARN: membaca dan menyetujui Kebijakan Privasi serta Ketentuan Layanan.",
};

export default async function ConsentPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
    columns: { consentPolicyVersion: true },
  });

  // Sudah setuju versi yang berlaku → tidak ada yang perlu ditanyakan lagi.
  // Mengunjungi /consent secara manual karena itu tidak menampilkan formulir
  // kosong, dan tidak pernah bisa "menyetujui dua kali".
  if (user && hasAcceptedCurrentPolicy(user.consentPolicyVersion)) {
    redirect("/modules");
  }

  return (
    <>
      <ConsentForm />
      <SiteFooter />
    </>
  );
}
