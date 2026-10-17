// src/app/(dashboard)/profile/privacy/page.tsx
// ─── Privasi & data (UU PDP) ──────────────────────────────────────────────────
// Halaman tempat hak-hak itu benar-benar bisa dipakai: unduh data sendiri, lihat
// persetujuan yang tersimpan, dan hapus akun tanpa menghubungi admin.
//
// Berada di dalam route group `(dashboard)`, jadi gerbang consent di
// src/app/(dashboard)/layout.tsx sudah menjamin pengunjungnya punya baris `users`
// dan persetujuan yang berlaku sebelum halaman ini dirender.
import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hasAcceptedCurrentPolicy, POLICY_VERSION } from "@/lib/policy";
import { RETENTION_POLICY } from "@/lib/retention";
import PrivacyClient from "@/components/profile/PrivacyClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privasi & Data Saya | NAWA-LEARN SMAN 2 Jonggol",
  description:
    "Unduh seluruh datamu sebagai JSON atau CSV, lihat persetujuan yang tersimpan, atau hapus akunmu sendiri.",
};

export default async function ProfilePrivacyPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
    columns: {
      id: true,
      name: true,
      email: true,
      consentPolicyVersion: true,
      consentAcceptedAt: true,
    },
  });

  // Gerbang di layout sudah menangani kasus ini; ini hanya jaring pengaman agar
  // halaman tidak pernah dirender tanpa subjek data yang jelas.
  if (!user) redirect("/consent");

  return (
    <PrivacyClient
      name={user.name}
      email={user.email}
      policyVersion={POLICY_VERSION}
      consentVersion={user.consentPolicyVersion}
      consentAcceptedAt={user.consentAcceptedAt ? user.consentAcceptedAt.toISOString() : null}
      consentIsCurrent={hasAcceptedCurrentPolicy(user.consentPolicyVersion)}
      retention={RETENTION_POLICY.map((rule) => ({
        label: rule.label,
        windowMonths: rule.windowMonths,
      }))}
    />
  );
}
