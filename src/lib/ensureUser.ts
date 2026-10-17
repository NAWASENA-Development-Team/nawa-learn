// src/lib/ensureUser.ts
// ─── Menyediakan baris `users` untuk sebuah sesi Clerk ────────────────────────
// Ada dua jalur yang membuat baris `users`, dan keduanya harus sepakat:
//
//   • webhook `user.created` (src/app/api/webhooks/clerk/route.ts) — jalur normal
//   • self-healing saat seseorang sudah punya sesi tetapi belum punya baris
//     (webhook belum jalan, salah konfigurasi, atau migrasi Clerk dev → produksi)
//
// Sebelum M11 logika self-healing itu hidup di dalam halaman profil saja, dan
// gerbang consent butuh hal yang sama. Menyalinnya akan membuat dua definisi
// "nama tampilan yang benar" yang pasti berbeda suatu hari, jadi ia dipindahkan
// ke sini.
//
// Inputnya diketik secara struktural, bukan sebagai tipe `User` milik Clerk:
// webhook dan `currentUser()` mengirim bentuk yang sedikit berbeda, dan modul ini
// tidak perlu tahu perbedaannya.
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface ClerkProfileLike {
  id: string;
  emailAddresses?: { emailAddress: string }[];
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  externalAccounts?: { provider: string }[];
}

/** Surel utama, dengan alamat tombstone bila Clerk tidak memberi satu pun. */
export function primaryEmail(profile: ClerkProfileLike): string {
  return profile.emailAddresses?.[0]?.emailAddress || `${profile.id}@user.nawasena.site`;
}

/**
 * Nama tampilan terbaik yang tersedia.
 *
 * Urutannya disengaja dan sudah terbukti di produksi: nama asli hanya dipakai
 * bila masuk lewat Google (di sana nama memang nama siswa), lalu username, lalu
 * nama depan/belakang, dan terakhir awalan surel.
 */
export function resolveDisplayName(profile: ClerkProfileLike): string {
  const { firstName, lastName, username, emailAddresses, externalAccounts } = profile;
  const isGoogleAuth = externalAccounts?.some(
    (account) => account.provider === "google" || account.provider === "oauth_google",
  );

  if (isGoogleAuth && (firstName || lastName)) {
    return `${firstName || ""} ${lastName || ""}`.trim();
  }
  if (username) return username;

  const fromName = `${firstName || ""} ${lastName || ""}`.trim();
  if (fromName) return fromName;

  return emailAddresses?.[0]?.emailAddress?.split("@")[0] || "Student";
}

/**
 * Kembalikan baris `users` untuk profil Clerk ini, buat bila belum ada.
 *
 * Bila sebuah baris sudah memakai surel yang sama dengan `clerk_id` berbeda
 * (kasus nyata saat berpindah dari instance Clerk dev ke produksi), baris itu
 * yang dipakai ulang — bukan diduplikasi — dan `clerk_id`-nya diperbarui.
 */
export async function ensureUserRow(profile: ClerkProfileLike) {
  const email = primaryEmail(profile);
  const name = resolveDisplayName(profile);

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existing) {
    if (existing.clerkId === profile.id && existing.name === name) return existing;
    const [updated] = await db
      .update(users)
      .set({ clerkId: profile.id, name })
      .where(eq(users.id, existing.id))
      .returning();
    return updated;
  }

  const [inserted] = await db
    .insert(users)
    .values({
      clerkId: profile.id,
      email,
      name,
      role: "student",
      points: 0,
    })
    .returning();
  return inserted;
}
