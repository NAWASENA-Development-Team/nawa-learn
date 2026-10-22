// tests/unit/participants.test.ts
// ─── "Peserta" punya satu definisi, dan staf manusia bukan peserta (M17) ──────
//
// Ada dua representasi dari aturan yang sama, dan itu disengaja: `IS_PARTICIPANT`
// adalah ekspresi SQL (dipakai `.where()` dan `count()`), sedangkan `isHumanStaff`
// adalah predikat TypeScript (dipakai halaman dan route). Dua representasi yang
// tidak diuji adalah dua definisi yang menunggu untuk berbeda — persis pola yang
// membuat papan peringkat dan halaman profil menjawab "total siswa" dengan angka
// berbeda sebelum M13.
//
// Berkas ini menjaga dua hal yang tidak bisa dilihat dari HTML:
//
//   1. Daftar peran di `participants.ts` tetap sama dengan `REVIEWER_ROLES`.
//   2. Predikatnya menjawab benar untuk **kursi musim**, termasuk kursi yang
//      sudah kedaluwarsa tetapi belum dicabut cron. Itu kasus yang paling mudah
//      salah: `role` masih `moderator`, jadi pemeriksaan yang hanya membaca
//      `role` akan menyembunyikan seorang siswa dari papan peringkatnya sendiri.
import { describe, expect, it, vi } from "vitest";

// `authz.ts` menarik lapisan database dan Clerk; keduanya tidak dipakai predikat
// murni di bawah, jadi cukup diganti tiruan — pola yang sama dengan
// `tests/unit/authz.test.ts`.
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

import { HUMAN_STAFF_ROLES, IS_HUMAN_STAFF, IS_PARTICIPANT } from "@/lib/participants";
import { REVIEWER_ROLES, isHumanStaff } from "@/lib/authz";

describe("HUMAN_STAFF_ROLES", () => {
  // Salinan yang dibiarkan berbeda dari aslinya adalah bug yang menunggu: satu
  // daftar dipakai untuk menyaring papan peringkat, yang lain untuk membuka
  // panel. Kalau keduanya berbeda, ada orang yang bisa meninjau tetapi tetap
  // muncul sebagai siswa — atau sebaliknya.
  it("is exactly REVIEWER_ROLES", () => {
    expect([...HUMAN_STAFF_ROLES].sort()).toEqual([...REVIEWER_ROLES].sort());
  });
});

describe("isHumanStaff", () => {
  it("recognises a moderator and an admin promoted by hand", () => {
    expect(isHumanStaff({ role: "moderator", seasonRoleKey: null })).toBe(true);
    expect(isHumanStaff({ role: "admin", seasonRoleKey: null })).toBe(true);
  });

  // The whole point of the M17 split. A seat *is* a student: it won the season
  // and holds a role until the season ends. Hiding it from the board would hide
  // the very person the podium is describing.
  it("does not count a season seat as staff", () => {
    expect(isHumanStaff({ role: "moderator", seasonRoleKey: "2026-Q4" })).toBe(false);
  });

  // The cron revokes expired seats, but it runs once a night. Between the season
  // turning and the cron running, `role` still says `moderator`. The key is what
  // distinguishes "staff" from "student who held a seat": a key that is not the
  // current one is still a key, so the person stays a participant — and a
  // *human* moderator's NULL key can never be mistaken for a stale season.
  it("keeps an expired-but-not-yet-revoked seat a participant", () => {
    expect(isHumanStaff({ role: "moderator", seasonRoleKey: "2000-Q1" })).toBe(false);
  });

  it("never counts a student or a contributor", () => {
    for (const role of ["guest", "student", "contributor"]) {
      expect(isHumanStaff({ role, seasonRoleKey: null })).toBe(false);
      expect(isHumanStaff({ role, seasonRoleKey: "2026-Q4" })).toBe(false);
    }
  });
});

describe("the SQL filters", () => {
  // `and()` returns `SQL | undefined`, and `.where(undefined)` silently means
  // "no filter at all". Building these with the `sql` template is what makes the
  // exclusion impossible to lose; this assertion is the cheap tripwire for
  // anyone who "simplifies" them back into an `and()` chain.
  it("are real expressions, never undefined", () => {
    expect(IS_HUMAN_STAFF).toBeDefined();
    expect(IS_PARTICIPANT).toBeDefined();
    expect(IS_HUMAN_STAFF).not.toBeUndefined();
    expect(IS_PARTICIPANT).not.toBeUndefined();
  });
});
